import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'] as string | undefined;
        const validKey = this.configService.get<string>('gatewayApiKey');

        if (!apiKey || !validKey) {
            throw new UnauthorizedException('Missing or invalid API key');
        }

        // Timing-safe comparison to prevent timing attacks
        const keyBuffer = Buffer.from(apiKey);
        const validBuffer = Buffer.from(validKey);

        if (
            keyBuffer.length !== validBuffer.length ||
            !timingSafeEqual(keyBuffer, validBuffer)
        ) {
            throw new UnauthorizedException('Missing or invalid API key');
        }

        return true;
    }
}
