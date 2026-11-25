import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'Charles Silva', description: 'Nome completo do utilizador' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'charles@exemplo.com', description: 'Email único' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'S3nh@Forte123',
    minLength: 8,
    maxLength: 128,
    description: 'Password (mínimo 8 caracteres)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}