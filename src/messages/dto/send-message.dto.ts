import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SendMessageDto {
    @IsNumber()
    @IsNotEmpty()
    kelasId: number;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
