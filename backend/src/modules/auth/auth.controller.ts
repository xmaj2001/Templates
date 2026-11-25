import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { AuthGateway } from './domain/auth.gateway';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import {
  AuthResponseDto,
  ErrorResponseDto,
  SessionResponseDto,
  SuccessResponseDto,
} from './dto/auth-responses.dto';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly gateway: AuthGateway) {}

  @AllowAnonymous()
  @Post('sign-up')
  @ApiOperation({
    summary: 'Criar conta com email e password',
    description: 'Cria o utilizador e inicia sessão. O cookie de sessão é devolvido em `Set-Cookie`.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Dados inválidos' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Email já registado' })
  async signUp(
    @Body() dto: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, setCookies } = await this.gateway.signUp(dto, req.headers);
    res.setHeader('set-cookie', setCookies);
    return { user };
  }

  @AllowAnonymous()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sessão com email e password',
    description: 'Devolve o utilizador e define o cookie de sessão em `Set-Cookie`.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Credenciais inválidas' })
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, setCookies } = await this.gateway.signIn(dto, req.headers);
    res.setHeader('set-cookie', setCookies);
    return { user };
  }

  @Get('session')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Obter utilizador e sessão atuais' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sem sessão válida' })
  async getSession(@Req() req: Request): Promise<SessionResponseDto> {
    const current = await this.gateway.getSession(req.headers);
    if (!current) throw new UnauthorizedException('Sessão inválida ou expirada');
    return current;
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Terminar sessão', description: 'Invalida a sessão e limpa o cookie.' })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SuccessResponseDto> {
    const { setCookies } = await this.gateway.signOut(req.headers);
    res.setHeader('set-cookie', setCookies);
    return { success: true };
  }
}