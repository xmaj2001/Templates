import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 'k3J9xQ2mP8vL1nR7tB4wY6zA' })
  id!: string;

  @ApiProperty({ example: 'Charles Silva' })
  name!: string;

  @ApiProperty({ example: 'charles@exemplo.com' })
  email!: string;

  @ApiProperty({ example: false })
  emailVerified!: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  image!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class SessionInfoDto {
  @ApiProperty({ example: 'sess_9f8a7b6c5d4e' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Quando a sessão expira' })
  expiresAt!: Date;

  @ApiProperty({ type: String, nullable: true, example: '102.67.10.1' })
  ipAddress!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Mozilla/5.0 ...' })
  userAgent!: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class SessionResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: SessionInfoDto })
  session!: SessionInfoDto;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Invalid email or password' })
  message!: string;

  @ApiPropertyOptional({ example: 'INVALID_EMAIL_OR_PASSWORD', description: 'Código do Better Auth' })
  code?: string;
}