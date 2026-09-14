import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';

export function configureApp(app: INestApplication) {
  app.use(
    '/auth',
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        statusCode: 429,
        message: 'Muitas tentativas. Tente novamente em um minuto.',
        error: 'Too Many Requests',
      },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
