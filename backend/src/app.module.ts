import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TransactionsController } from './transactions/transactions.controller.js';
import { PrismaService } from './prisma/prisma.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { PasswordService } from './auth/password.service.js';
import { TokenService } from './auth/token.service.js';

@Module({
  imports: [],
  controllers: [AppController, TransactionsController, AuthController],
  providers: [
    AppService,
    PrismaService,
    AuthService,
    AuthGuard,
    PasswordService,
    TokenService,
  ],
})
export class AppModule {}
