import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Body,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';

@Controller('whatsapp')
@UseGuards(ApiKeyGuard)
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Post('session/start')
    async startSession(@Body('kelasId', ParseIntPipe) kelasId: number) {
        const result = await this.whatsappService.initSession(kelasId);
        const isConnected = result.status === 'connected';
        return {
            connected: isConnected,
            kelasId,
            status: result.status,
            userId: isConnected ? this.whatsappService.getUserId(kelasId) : null,
            message: isConnected
                ? 'Session sudah terkoneksi.'
                : 'Session dimulai. Silakan scan QR code via GET /api/whatsapp/session/qr/' + kelasId,
        };
    }

    @Get('session/qr/:kelasId')
    async getQrCode(@Param('kelasId', ParseIntPipe) kelasId: number) {
        const qr = await this.whatsappService.getQrCode(kelasId);
        return { qr };
    }

    @Delete('session/:kelasId')
    async logoutSession(@Param('kelasId', ParseIntPipe) kelasId: number) {
        await this.whatsappService.logoutSession(kelasId);
        return {
            success: true,
            message: `Session for kelasId=${kelasId} has been logged out and purged.`,
        };
    }
}
