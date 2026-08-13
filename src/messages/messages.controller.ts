import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';

@Controller('messages')
@UseGuards(ApiKeyGuard)
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post('send')
    async sendMessage(@Body() dto: SendMessageDto) {
        return this.messagesService.sendMessage(dto);
    }
}
