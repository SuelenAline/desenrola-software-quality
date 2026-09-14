import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService, TOKEN_TTL_SECONDS } from './token.service.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';
import type { ConfirmPasswordDto, UpdateAccountDto } from './account.dto.js';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
// A valid dummy hash keeps the expensive comparison on the unknown-email path too.
const DUMMY_HASH = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(data: RegisterDto) {
    const passwordHash = await this.passwords.hash(data.password);
    try {
      const user = await this.prisma.user.create({
        data: { name: data.name, email: data.email, passwordHash },
        select: publicUserSelect,
      });
      return this.session(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('E-mail já cadastrado.');
      }
      throw error;
    }
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    const valid = await this.passwords.verify(
      data.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid)
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    const { id, name, email, createdAt } = user;
    return this.session({ id, name, email, createdAt }, user.tokenVersion);
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    return user;
  }

  async updateAccount(userId: number, data: UpdateAccountDto) {
    if (
      data.name === undefined &&
      data.email === undefined &&
      data.password === undefined
    ) {
      throw new BadRequestException('Informe ao menos um campo para alterar.');
    }
    const user = await this.confirmPassword(userId, data.currentPassword);
    const changes: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) changes.name = data.name;
    if (data.email !== undefined) changes.email = data.email;
    if (data.password !== undefined) {
      changes.passwordHash = await this.passwords.hash(data.password);
      changes.tokenVersion = { increment: 1 };
    }
    try {
      return await this.prisma.user.update({
        // Fail if the password changed concurrently after confirmation.
        where: { id: userId, passwordHash: user.passwordHash },
        data: changes,
        select: publicUserSelect,
      });
    } catch (error) {
      this.handleAccountWriteError(error);
    }
  }

  async deleteAccount(userId: number, data: ConfirmPasswordDto): Promise<void> {
    const user = await this.confirmPassword(userId, data.currentPassword);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.user.delete({
          where: { id: userId, passwordHash: user.passwordHash },
        });
      });
    } catch (error) {
      this.handleAccountWriteError(error);
    }
  }

  private async confirmPassword(userId: number, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const valid = await this.passwords.verify(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid)
      throw new UnauthorizedException('Senha atual inválida.');
    return user;
  }

  private handleAccountWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('E-mail já cadastrado.');
      if (error.code === 'P2025')
        throw new ConflictException(
          'A conta foi alterada. Faça login e tente novamente.',
        );
    }
    throw error;
  }

  private async session(
    user: {
      id: number;
      name: string;
      email: string;
      createdAt: Date;
    },
    tokenVersion = 0,
  ) {
    return {
      access_token: await this.tokens.issue(user.id, tokenVersion),
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      user,
    };
  }
}
