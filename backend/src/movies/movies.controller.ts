import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TmdbService } from './tmdb.service';

function positiveInteger(
  value: unknown,
  maximum: number,
  field: string,
): number {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw new BadRequestException(
      `${field} must be an integer from 1 to ${maximum}`,
    );
  }
  return Number(value);
}

@Controller('movies')
export class MoviesController {
  constructor(
    private readonly tmdb: TmdbService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('search')
  search(@Query('q') query: unknown, @Query('page') page: unknown) {
    if (
      typeof query !== 'string' ||
      !query.trim() ||
      query.trim().length > 200 ||
      // eslint-disable-next-line no-control-regex -- Intentionally reject control characters in search input.
      /[\u0000-\u001f\u007f]/.test(query)
    ) {
      throw new BadRequestException(
        'q must be 1 to 200 characters without control characters',
      );
    }
    return this.tmdb.search(
      query.trim(),
      positiveInteger(page === undefined ? '1' : page, 500, 'page'),
    );
  }

  @Post('tmdb/:tmdbId')
  @HttpCode(200)
  async select(@Param('tmdbId') value: string, @Body() body: unknown) {
    const id = positiveInteger(value, 2_147_483_647, 'tmdbId');
    if (
      body !== undefined &&
      (!body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length)
    ) {
      throw new BadRequestException(
        'Select by TMDB id only; movie metadata is fetched by the server',
      );
    }
    const where = {
      source_externalId: { source: 'TMDB' as const, externalId: String(id) },
    };
    const existing = await this.prisma.movieExternalId.findUnique({
      where,
      include: { movie: true },
    });
    if (existing) return existing.movie;

    const movie = await this.tmdb.details(id);
    try {
      // Nested creation is atomic: a duplicate external id rolls back its Movie too.
      const link = await this.prisma.movieExternalId.create({
        data: {
          source: 'TMDB',
          externalId: String(id),
          movie: {
            create: {
              title: movie.title,
              originalTitle: movie.originalTitle,
              releaseDate: movie.releaseDate
                ? new Date(`${movie.releaseDate}T00:00:00.000Z`)
                : null,
            },
          },
        },
        include: { movie: true },
      });
      return link.movie;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.movieExternalId.findUnique({
          where,
          include: { movie: true },
        });
        if (winner) return winner.movie;
      }
      throw error;
    }
  }
}
