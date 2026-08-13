import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    OnModuleDestroy,
} from '@nestjs/common';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    type WASocket,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

const IDLE_TIMEOUT_MS = 300_000; // 5 minutes
const SESSIONS_DIR = './sessions';

@Injectable()
export class WhatsappService implements OnModuleDestroy {
    private readonly logger = new Logger(WhatsappService.name);

    private sessions = new Map<number, WASocket>();
    private idleTimers = new Map<number, NodeJS.Timeout>();
    private qrCodes = new Map<number, string>();
    private connectingLocks = new Map<number, Promise<WASocket>>();
    private sockets = new Map<number, WASocket>(); // raw socket (even before 'open')

    /** Gracefully close all active sockets on app shutdown */
    onModuleDestroy() {
        for (const [kelasId, socket] of this.sessions) {
            this.logger.log(`Shutting down session for kelasId=${kelasId}`);
            socket.end(undefined);
            const timer = this.idleTimers.get(kelasId);
            if (timer) clearTimeout(timer);
        }
        this.sessions.clear();
        this.idleTimers.clear();
        this.qrCodes.clear();
        this.connectingLocks.clear();
    }

    /**
     * Non-blocking: start a session and return immediately.
     * Used by POST /session/start — kicks off the Baileys socket so QR code
     * gets generated, but does NOT wait for the QR to be scanned.
     */
    async initSession(kelasId: number): Promise<{ status: string }> {
        // Already connected
        if (this.sessions.has(kelasId)) {
            this.resetIdleTimer(kelasId);
            return { status: 'connected' };
        }

        // Already initializing (socket exists but not yet open)
        if (this.sockets.has(kelasId)) {
            return { status: 'waiting_for_qr' };
        }

        // Fire-and-forget: create the socket in background
        this.createSession(kelasId).catch((err) => {
            this.logger.error(`Background session init failed for kelasId=${kelasId}`, err);
        });

        // Give Baileys a moment to emit the first QR
        await new Promise((r) => setTimeout(r, 1500));

        return { status: this.qrCodes.has(kelasId) ? 'qr_ready' : 'initializing' };
    }

    /**
     * Blocking: lazy-load or return existing WASocket for a given kelasId.
     * Used by MessagesService — waits until connection is fully open.
     * Throws immediately if no credentials exist (needs QR scan first).
     */
    async getOrConnectSession(kelasId: number): Promise<WASocket> {
        const existing = this.sessions.get(kelasId);
        if (existing) {
            this.resetIdleTimer(kelasId);
            return existing;
        }

        // Check if credentials exist on disk — if not, user must scan QR first
        const sessionDir = this.getSessionPath(kelasId);
        const credsFile = path.join(sessionDir, 'creds.json');
        if (!fs.existsSync(credsFile)) {
            throw new BadRequestException(
                `Belum ada session untuk kelasId=${kelasId}. Silakan hit POST /api/whatsapp/session/start lalu scan QR terlebih dahulu.`,
            );
        }

        // Prevent duplicate concurrent connections for the same kelasId
        const pendingLock = this.connectingLocks.get(kelasId);
        if (pendingLock) {
            return pendingLock;
        }

        const connectPromise = this.createSession(kelasId);
        this.connectingLocks.set(kelasId, connectPromise);

        try {
            const socket = await connectPromise;
            return socket;
        } finally {
            this.connectingLocks.delete(kelasId);
        }
    }

    /**
     * Returns the latest base64-encoded QR code image for a kelasId.
     */
    async getQrCode(kelasId: number): Promise<string> {
        const qr = this.qrCodes.get(kelasId);
        if (!qr) {
            throw new NotFoundException(
                `No QR code available for kelasId=${kelasId}. Start a session first.`,
            );
        }
        return qr;
    }

    /**
     * Explicitly logout: close socket, clear memory, and DELETE credential files.
     */
    async logoutSession(kelasId: number): Promise<void> {
        const socket = this.sessions.get(kelasId);
        if (socket) {
            await socket.logout('Admin requested logout');
            socket.end(undefined);
        }

        this.cleanupSessionMemory(kelasId);

        // Recursively delete credential folder from disk
        const sessionDir = this.getSessionPath(kelasId);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            this.logger.log(`Deleted session directory: ${sessionDir}`);
        }
    }

    /**
     * Resets the 5-minute idle timer for a given kelasId.
     * When the timer fires, the socket is closed and removed from memory
     * but credential files are KEPT on disk.
     */
    resetIdleTimer(kelasId: number): void {
        const existing = this.idleTimers.get(kelasId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.logger.log(
                `Idle timeout reached for kelasId=${kelasId}. Closing socket.`,
            );
            this.closeSession(kelasId);
        }, IDLE_TIMEOUT_MS);

        this.idleTimers.set(kelasId, timer);
    }

    // ──────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────

    private getSessionPath(kelasId: number): string {
        return path.join(SESSIONS_DIR, `class_${kelasId}`);
    }

    /**
     * Create a new Baileys socket for the given kelasId.
     * Returns a promise that resolves when the connection is open,
     * or rejects on fatal error.
     */
    private async createSession(kelasId: number): Promise<WASocket> {
        const sessionDir = this.getSessionPath(kelasId);

        // Ensure sessions directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const socket = makeWASocket({
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            printQRInTerminal: false,
        });

        // Track raw socket immediately (before 'open')
        this.sockets.set(kelasId, socket);

        return new Promise<WASocket>((resolve, reject) => {
            let resolved = false;

            socket.ev.on('creds.update', saveCreds);

            socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Store QR code as base64 PNG for HTTP retrieval
                if (qr) {
                    try {
                        const qrBase64 = await QRCode.toDataURL(qr);
                        this.qrCodes.set(kelasId, qrBase64);
                        this.logger.log(`QR code generated for kelasId=${kelasId}`);
                    } catch (err) {
                        this.logger.error(`QR generation error for kelasId=${kelasId}`, err);
                    }
                }

                if (connection === 'open') {
                    this.logger.log(`Session connected for kelasId=${kelasId}`);
                    this.sessions.set(kelasId, socket);
                    this.qrCodes.delete(kelasId); // QR no longer needed
                    this.resetIdleTimer(kelasId);

                    if (!resolved) {
                        resolved = true;
                        resolve(socket);
                    }
                }

                if (connection === 'close') {
                    const statusCode =
                        (lastDisconnect?.error as any)?.output?.statusCode ?? 0;

                    if (statusCode === DisconnectReason.loggedOut) {
                        // 401 — credential revoked, purge everything
                        this.logger.warn(
                            `Session logged out for kelasId=${kelasId}. Purging credentials.`,
                        );
                        this.cleanupSessionMemory(kelasId);

                        if (fs.existsSync(sessionDir)) {
                            fs.rmSync(sessionDir, { recursive: true, force: true });
                        }

                        if (!resolved) {
                            resolved = true;
                            reject(
                                new BadRequestException(
                                    `Session for kelasId=${kelasId} was logged out. Please re-scan QR.`,
                                ),
                            );
                        }
                    } else {
                        // Temporary disconnect — attempt reconnect
                        this.logger.warn(
                            `Session disconnected for kelasId=${kelasId} (status=${statusCode}). Reconnecting...`,
                        );
                        this.cleanupSessionMemory(kelasId);

                        // Exponential backoff-style delay before reconnect
                        setTimeout(async () => {
                            try {
                                await this.getOrConnectSession(kelasId);
                            } catch (err) {
                                this.logger.error(
                                    `Reconnect failed for kelasId=${kelasId}`,
                                    err,
                                );
                            }
                        }, 3000);

                        if (!resolved) {
                            resolved = true;
                            reject(
                                new BadRequestException(
                                    `Connection closed for kelasId=${kelasId}. Retrying automatically.`,
                                ),
                            );
                        }
                    }
                }
            });
        });
    }

    /**
     * Close socket & remove from memory maps WITHOUT deleting credentials.
     */
    private closeSession(kelasId: number): void {
        const socket = this.sessions.get(kelasId);
        if (socket) {
            socket.end(undefined);
        }
        this.cleanupSessionMemory(kelasId);
    }

    /**
     * Remove all in-memory references for a kelasId.
     */
    private cleanupSessionMemory(kelasId: number): void {
        this.sessions.delete(kelasId);
        this.sockets.delete(kelasId);
        this.qrCodes.delete(kelasId);
        const timer = this.idleTimers.get(kelasId);
        if (timer) clearTimeout(timer);
        this.idleTimers.delete(kelasId);
    }
}
