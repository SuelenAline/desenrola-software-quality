import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (
      context.switchToHttp().getRequest<AuthenticatedRequest>().role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Área exclusiva para administradores.');
    }
    return true;
  }
}
