import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { AuthModule } from './auth/auth.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { MessagesModule } from './messages/messages.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    WhatsappModule,
    MessagesModule,
  ],
})
export class AppModule { }
