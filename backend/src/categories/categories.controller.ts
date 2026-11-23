import { Body, ConflictException, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { auditedWrite } from '../prisma/audited-write.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').normalize('NFC') : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUserId() userId: number) {
    return this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  }

  @Post()
  async create(@CurrentUserId() userId: number, @Body() data: CreateCategoryDto) {
    try {
      return await auditedWrite(this.prisma, userId, 'CATEGORY_CREATED', tx => tx.category.create({
        data: { userId, name: data.name, normalizedName: data.name.toLocaleLowerCase('pt-BR') },
        select: { id: true, name: true },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Você já possui uma categoria com esse nome.');
      }
      throw error;
    }
  }
}
