import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const VERSION = 'scrypt-v1';

@Injectable()
export class PasswordService {
  private derive(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        64,
        { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
        (error, key) => {
          if (error) reject(error);
          else resolve(key);
        },
      );
    });
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = await this.derive(password, salt);
    return `${VERSION}$${salt}$${key.toString('hex')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [version, salt, hash, extra] = storedHash.split('$');
    if (
      version !== VERSION ||
      !salt ||
      !/^[a-f0-9]{32}$/.test(salt) ||
      !hash ||
      !/^[a-f0-9]{128}$/.test(hash) ||
      extra !== undefined
    )
      return false;
    const actual = await this.derive(password, salt);
    return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
  }
}
