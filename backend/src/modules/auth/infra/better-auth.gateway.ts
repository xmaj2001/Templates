import { HttpException, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import {
  AuthGateway,
  AuthResult,
  AuthUser,
  CurrentSession,
} from '../domain/auth.gateway';
import { auth } from '../../../shared/auth/auth';

@Injectable()
export class BetterAuthGateway extends AuthGateway {
  constructor(private readonly authService: AuthService<typeof auth>) {
    super();
  }

  async signUp(
    input: { name: string; email: string; password: string },
    headers: IncomingHttpHeaders,
  ): Promise<AuthResult> {
    try {
      const { headers: resHeaders, response } = await this.authService.api.signUpEmail({
        body: input,
        headers: fromNodeHeaders(headers),
        returnHeaders: true,
      });
      return {
        user: this.toUser(response.user),
        setCookies: resHeaders.getSetCookie(),
      };
    } catch (e) {
      this.rethrow(e);
    }
  }

  async signIn(
    input: { email: string; password: string; rememberMe?: boolean },
    headers: IncomingHttpHeaders,
  ): Promise<AuthResult> {
    try {
      const { headers: resHeaders, response } = await this.authService.api.signInEmail({
        body: input,
        headers: fromNodeHeaders(headers),
        returnHeaders: true,
      });
      return {
        user: this.toUser(response.user),
        setCookies: resHeaders.getSetCookie(),
      };
    } catch (e) {
      this.rethrow(e);
    }
  }

  async signOut(headers: IncomingHttpHeaders): Promise<{ setCookies: string[] }> {
    try {
      const { headers: resHeaders } = await this.authService.api.signOut({
        headers: fromNodeHeaders(headers),
        returnHeaders: true,
      });
      return { setCookies: resHeaders.getSetCookie() };
    } catch (e) {
      this.rethrow(e);
    }
  }

  async getSession(headers: IncomingHttpHeaders): Promise<CurrentSession | null> {
    const data = await this.authService.api.getSession({
      headers: fromNodeHeaders(headers),
    });
    if (!data) return null;
    return {
      user: this.toUser(data.user),
      session: {
        id: data.session.id,
        expiresAt: data.session.expiresAt,
        ipAddress: data.session.ipAddress ?? null,
        userAgent: data.session.userAgent ?? null,
      },
    };
  }

  private toUser(u: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AuthUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      image: u.image ?? null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  /** Converte APIError do Better Auth em HttpException do Nest */
  private rethrow(e: unknown): never {
    if (e instanceof APIError) {
      const status = Number(e.statusCode);
      throw new HttpException(
        { statusCode: status, message: e.message, code: e.body?.code },
        status,
      );
    }
    throw e;
  }
}