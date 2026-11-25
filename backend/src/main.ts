import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { setupScalar } from './shared/setup-scalar';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    bodyParser: false, // Required for Better Auth
  });

  app.enableVersioning({ type: VersioningType.URI });

  app.enableCors({
    origin: [process.env.ORIGEN as string, 'http://localhost:3000'],
    credentials: true,
  });

  setupScalar(app, 'BACKEND', process.env.NODE_ENV === 'production');
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
