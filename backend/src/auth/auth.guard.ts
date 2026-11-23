import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

export type AuthenticatedRequest = Request & { userId: number; role: UserRole };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match) throw new UnauthorizedException('Informe o token Bearer.');
    const { userId, tokenVersion } = await this.tokens.verifySession(match[1]);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tokenVersion: true, active: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    if (!user.active) throw new UnauthorizedException('Conta inativa.');
    request.userId = userId;
    request.role = user.role;
    if (user.tokenVersion !== tokenVersion)
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    return true;
  }
}
