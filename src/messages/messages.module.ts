import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessagesController } from './messages.controller.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [WhatsappModule, AuthModule],
    controllers: [MessagesController],
    providers: [MessagesService],
})
export class MessagesModule { }
