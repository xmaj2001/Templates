// src/setup-scalar.ts
import { apiReference } from '@scalar/nestjs-api-reference';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupScalar = (
  app: NestExpressApplication,
  name: string,
  isProd: boolean,
) => {
  if (isProd) return;

  const config = new DocumentBuilder()
    .setTitle(name)
    .setDescription('Backend API')
    .setVersion('1.0.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/doc',
    apiReference({
      content: document,
      theme: 'deepSpace',
    }),
  );
};