import type { IncomingHttpHeaders } from 'node:http';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSessionInfo {
  id: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthResult {
  user: AuthUser;
  /** Cookies a reencaminhar ao browser (Set-Cookie) */
  setCookies: string[];
}

export interface CurrentSession {
  user: AuthUser;
  session: AuthSessionInfo;
}

export abstract class AuthGateway {
  abstract signUp(
    input: { name: string; email: string; password: string },
    headers: IncomingHttpHeaders,
  ): Promise<AuthResult>;

  abstract signIn(
    input: { email: string; password: string; rememberMe?: boolean },
    headers: IncomingHttpHeaders,
  ): Promise<AuthResult>;

  abstract signOut(headers: IncomingHttpHeaders): Promise<{ setCookies: string[] }>;

  abstract getSession(headers: IncomingHttpHeaders): Promise<CurrentSession | null>;
}