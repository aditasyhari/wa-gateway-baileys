import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Injectable()
export class MessagesService {
    private readonly logger = new Logger(MessagesService.name);

    constructor(private readonly whatsappService: WhatsappService) { }

    async sendMessage(dto: SendMessageDto) {
        const socket = await this.whatsappService.getOrConnectSession(dto.kelasId);

        // Format phone number to WhatsApp JID
        const jid = `${dto.phone.replace(/\D/g, '')}@s.whatsapp.net`;

        await socket.sendMessage(jid, { text: dto.message });

        // Reset idle timer after successful send
        this.whatsappService.resetIdleTimer(dto.kelasId);

        this.logger.log(
            `Message sent to ${jid} via kelasId=${dto.kelasId}`,
        );

        return {
            success: true,
            message: 'Message sent successfully',
            to: jid,
            kelasId: dto.kelasId,
        };
    }
}
