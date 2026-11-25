import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGateway } from './domain/auth.gateway';
import { BetterAuthGateway } from './infra/better-auth.gateway';

@Module({
  controllers: [AuthController],
  providers: [{ provide: AuthGateway, useClass: BetterAuthGateway }],
  exports: [AuthGateway],
})
export class AuthApiModule {}