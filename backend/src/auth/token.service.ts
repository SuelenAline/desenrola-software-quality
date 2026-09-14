import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'desenrola-api';
const AUDIENCE = 'desenrola';
export const TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error(
        'Configure JWT_SECRET com um segredo aleatório de pelo menos 32 bytes.',
      );
    }
    this.key = new TextEncoder().encode(secret);
  }

  issue(userId: number, tokenVersion = 0): Promise<string> {
    return new SignJWT({ tokenVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(String(userId))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<number> {
    return (await this.verifySession(token)).userId;
  }

  async verifySession(
    token: string,
  ): Promise<{ userId: number; tokenVersion: number }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['sub', 'iat', 'exp'],
        maxTokenAge: `${TOKEN_TTL_SECONDS}s`,
      });
      const id = Number(payload.sub);
      if (
        !payload.sub ||
        !/^[1-9]\d*$/.test(payload.sub) ||
        !Number.isInteger(id) ||
        id > 2147483647
      )
        throw new Error('Invalid subject');
      // Tokens issued before session versioning belong to version zero.
      const tokenVersion =
        payload.tokenVersion === undefined ? 0 : payload.tokenVersion;
      if (
        typeof tokenVersion !== 'number' ||
        !Number.isSafeInteger(tokenVersion) ||
        tokenVersion < 0
      )
        throw new Error('Invalid token version');
      return { userId: id, tokenVersion };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
