import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.metadata';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseViewingInput, resolveViewingContext } from './viewing-input';

@Controller('viewings')
export class MovieViewingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = resolveViewingContext(parseViewingInput(body, 'create'));
    try {
      return await this.prisma.movieViewing.create({
        data: { ...data, userId: request.user!.id },
        include: { movie: true },
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = parseViewingInput(body, 'patch');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const where = { id, userId: request.user!.id };
          const current = await tx.movieViewing.findFirst({
            where,
            select: { viewingType: true },
          });
          if (!current) throw new NotFoundException();
          // The type used to validate a partial patch must not race a type change.
          return tx.movieViewing.update({
            where,
            data: resolveViewingContext(data, current.viewingType),
            include: { movie: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.prisma.movieViewing.deleteMany({
      where: { id, userId: request.user!.id },
    });
    if (!result.count) throw new NotFoundException();
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') throw new NotFoundException();
      if (error.code === 'P2034')
        throw new ConflictException(
          'Viewing changed concurrently. Reload and retry.',
        );
      if (error.code === 'P2003')
        throw new BadRequestException(
          'Referenced movie or cinema does not exist',
        );
    }
    throw error;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.prisma.movieViewing.findMany({
      where: { userId: request.user!.id },
      orderBy: [{ watchedOn: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { movie: true },
    });
  }

  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const viewing = await this.prisma.movieViewing.findFirst({
      where: { id, userId: request.user!.id },
      include: { movie: true },
    });
    if (!viewing) throw new NotFoundException();
    return viewing;
  }
}
