# 📋 TECHNICAL PRD: WA GATEWAY MICROSERVICE (NESTJS + BAILEYS)

## 1. Executive Summary
Microservice WhatsApp Gateway berbasis NestJS & Baileys untuk mengirimkan notifikasi

---

## 2. Infrastructure & System Constraints
- **Target Spec:** 1 Core VPS / 1-2 GB RAM.
- **Primary Objective:** Zero memory leak, extreme RAM optimization.
- **Session Architecture:** Dedicated session uniquely bound to `kelasId` (number).
- **Session Persistence Path:** `./sessions/class_{kelasId}/`

---

## 3. Core Technical Rules
1. **RAM Optimization:**
   - Disable full history sync (`syncFullHistory: false`).
   - Disable history download (`downloadHistory: false`).
   - Disable auto online status (`markOnlineOnConnect: false`).
2. **Lazy Loading & Auto-Sleep (RAM Saver):**
   - Socket connection ONLY opens on-demand when sending a message or requesting a QR scan.
   - Set a **5-minute (300,000ms) Idle Timer** per `kelasId`.
   - When idle timer expires, CLOSE the WebSocket and purge the instance from memory.
   - **DO NOT** delete credential files in `./sessions/class_{kelasId}/` on auto-sleep.
3. **Security:**
   - Protect all REST endpoints using `ApiKeyGuard` validating the `x-api-key` header against `GATEWAY_API_KEY`.

---

## 4. API Specs & Endpoints

### A. Session Management
- **Start Session:** `POST /api/whatsapp/session/start`
  - Payload: `{ "kelasId": number }`
- **Get QR Code:** `GET /api/whatsapp/session/qr/:kelasId`
  - Response: `{ "qr": "data:image/png;base64,..." }`
- **Delete / Logout:** `DELETE /api/whatsapp/session/:kelasId`
  - Action: Destroy socket, purge memory, and RECURSIVELY DELETE `./sessions/class_{kelasId}/`.

### B. Messaging
- **Send Text:** `POST /api/messages/send`
  - Payload: `{ "kelasId": number, "phone": string, "message": string }`
  - Execution Flow: 
    1. Call `getOrConnectSession(kelasId)`.
    2. Dispatch text message via Baileys.
    3. Reset the 5-minute Idle Timer.
    4. Return success/error JSON.

---

## 5. Connection Lifecycle & Edge Cases
- **401 Logged Out:** If status code is 401 (`DisconnectReason.loggedOut`), clean directory `./sessions/class_{kelasId}` and trigger webhook to Laravel.
- **Temporary Disconnect:** Retry auto-reconnect using backoff strategy.
- **App Boot / Restart:** Scan `./sessions` folder, but **DO NOT** eager-connect all sockets. Connect strictly on-demand.