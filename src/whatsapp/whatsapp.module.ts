import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappController } from './whatsapp.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [AuthModule],
    controllers: [WhatsappController],
    providers: [WhatsappService],
    exports: [WhatsappService],
})
export class WhatsappModule { }
