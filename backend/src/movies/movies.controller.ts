import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TmdbService } from './tmdb.service';
import { movieResponse } from './movie-response';

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
    if (existing) {
      const current = existing.movie;
      if (current.releaseDate && current.runtimeMinutes && current.posterPath)
        return movieResponse(current);
      let details: Awaited<ReturnType<TmdbService['details']>>;
      try {
        details = await this.tmdb.details(id);
      } catch (error) {
        // Optional enrichment must not prevent recording a known movie offline.
        if (error instanceof HttpException) return movieResponse(current);
        throw error;
      }
      const enriched = await this.prisma.$transaction(async (tx) => {
        // Conditional writes preserve metadata filled by another selection meanwhile.
        if (details.releaseDate)
          await tx.movie.updateMany({
            where: { id: current.id, releaseDate: null },
            data: {
              releaseDate: new Date(`${details.releaseDate}T00:00:00.000Z`),
            },
          });
        if (details.runtimeMinutes)
          await tx.movie.updateMany({
            where: { id: current.id, runtimeMinutes: null },
            data: { runtimeMinutes: details.runtimeMinutes },
          });
        if (details.posterPath)
          await tx.movie.updateMany({
            where: { id: current.id, posterPath: null },
            data: { posterPath: details.posterPath },
          });
        return tx.movie.findUniqueOrThrow({ where: { id: current.id } });
      });
      return movieResponse(enriched);
    }

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
              runtimeMinutes: movie.runtimeMinutes,
              posterPath: movie.posterPath,
              releaseDate: movie.releaseDate
                ? new Date(`${movie.releaseDate}T00:00:00.000Z`)
                : null,
            },
          },
        },
        include: { movie: true },
      });
      return movieResponse(link.movie);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.movieExternalId.findUnique({
          where,
          include: { movie: true },
        });
        if (winner) return movieResponse(winner.movie);
      }
      throw error;
    }
  }
}
