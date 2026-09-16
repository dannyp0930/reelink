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
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.metadata';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseViewingInput, resolveViewingContext } from './viewing-input';
import { movieResponse, movieSelect } from '../movies/movie-response';
import { parseViewingQuery } from './viewing-query';

const viewingInclude = {
  movie: { select: movieSelect },
  cinema: {
    select: { id: true, name: true, chain: true, status: true, address: true },
  },
} satisfies Prisma.MovieViewingInclude;

function viewingResponse(
  viewing: Prisma.MovieViewingGetPayload<{ include: typeof viewingInclude }>,
) {
  return { ...viewing, movie: movieResponse(viewing.movie) };
}

@Controller('viewings')
export class MovieViewingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = resolveViewingContext(parseViewingInput(body, 'create'));
    try {
      return viewingResponse(
        await this.prisma.movieViewing.create({
          data: { ...data, userId: request.user!.id },
          include: viewingInclude,
        }),
      );
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
      return viewingResponse(
        await this.prisma.$transaction(
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
              include: viewingInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
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
  async list(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    const { where: filters, orderBy, page, limit } = parseViewingQuery(query);
    const where = { ...filters, userId: request.user!.id };
    // Count and rows must describe the same snapshot within this response.
    const [totalItems, rows] = await this.prisma.$transaction(
      [
        this.prisma.movieViewing.count({ where }),
        this.prisma.movieViewing.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: viewingInclude,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: rows.map(viewingResponse),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }

  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const viewing = await this.prisma.movieViewing.findFirst({
      where: { id, userId: request.user!.id },
      include: viewingInclude,
    });
    if (!viewing) throw new NotFoundException();
    return viewingResponse(viewing);
  }
}
