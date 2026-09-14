import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { ConfirmPasswordDto, UpdateAccountDto } from './account.dto.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUserId } from './current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  profile(@CurrentUserId() userId: number) {
    return this.auth.profile(userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateAccount(
    @CurrentUserId() userId: number,
    @Body() data: UpdateAccountDto,
  ) {
    return this.auth.updateAccount(userId, data);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  deleteAccount(
    @CurrentUserId() userId: number,
    @Body() data: ConfirmPasswordDto,
  ) {
    return this.auth.deleteAccount(userId, data);
  }

  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.auth.register(data);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() data: LoginDto) {
    return this.auth.login(data);
  }
}
