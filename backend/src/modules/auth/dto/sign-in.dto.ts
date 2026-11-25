import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'charles@exemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3nh@Forte123' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Se false, a sessão termina ao fechar o browser',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}