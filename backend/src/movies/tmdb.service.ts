import 'dotenv/config';
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { posterPath, posterUrl } from './movie-response';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException('Invalid TMDB response');
  }
  return value as Record<string, unknown>;
}

function movieSummary(value: unknown) {
  const row = record(value);
  if (
    !Number.isSafeInteger(row.id) ||
    (row.id as number) <= 0 ||
    (row.id as number) > 2_147_483_647
  ) {
    throw new BadGatewayException('Invalid TMDB movie id');
  }
  if (
    typeof row.title !== 'string' ||
    !row.title.trim() ||
    row.title.length > 1000 ||
    row.title.includes('\0')
  ) {
    throw new BadGatewayException('Invalid TMDB movie title');
  }
  const originalTitle = row.original_title ?? null;
  if (
    originalTitle !== null &&
    (typeof originalTitle !== 'string' ||
      originalTitle.length > 1000 ||
      originalTitle.includes('\0'))
  ) {
    throw new BadGatewayException('Invalid TMDB original title');
  }
  const releaseDate =
    row.release_date === '' ? null : (row.release_date ?? null);
  if (releaseDate !== null) {
    if (
      typeof releaseDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ||
      releaseDate.startsWith('0000')
    ) {
      throw new BadGatewayException('Invalid TMDB release date');
    }
    const date = new Date(`${releaseDate}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== releaseDate
    ) {
      throw new BadGatewayException('Invalid TMDB release date');
    }
  }
  return {
    tmdbId: row.id as number,
    title: row.title,
    originalTitle: originalTitle || null,
    releaseDate: releaseDate,
  };
}

@Injectable()
export class TmdbService {
  private async request(url: URL, allowNotFound = false): Promise<unknown> {
    const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
    if (!token)
      throw new ServiceUnavailableException('Movie search is not configured');
    const signal = AbortSignal.timeout(10_000);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal,
      });
      if (response.status === 404 && allowNotFound)
        throw new NotFoundException('TMDB movie not found');
      if ([401, 403, 429].includes(response.status))
        throw new ServiceUnavailableException(
          'TMDB is temporarily unavailable',
        );
      if (!response.ok) throw new BadGatewayException('TMDB request failed');
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        signal.aborted ||
        (error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'TimeoutError')
      )
        throw new GatewayTimeoutException('TMDB request timed out');
      // Never forward provider bodies, credentials or network exception details.
      throw new BadGatewayException('TMDB request failed');
    }
  }

  async search(query: string, page: number) {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.search = new URLSearchParams({
      query,
      page: String(page),
      language: 'ko-KR',
      include_adult: 'false',
    }).toString();
    const data = record(await this.request(url));
    if (
      data.page !== page ||
      !Number.isSafeInteger(data.total_pages) ||
      (data.total_pages as number) < 0 ||
      !Array.isArray(data.results)
    ) {
      throw new BadGatewayException('Invalid TMDB search response');
    }
    return {
      page,
      totalPages: Math.min(data.total_pages as number, 500),
      results: data.results.map((value: unknown) => {
        const movie = movieSummary(value);
        return { ...movie, posterUrl: posterUrl(record(value).poster_path) };
      }),
    };
  }

  async details(id: number) {
    const url = new URL(`https://api.themoviedb.org/3/movie/${id}`);
    url.searchParams.set('language', 'ko-KR');
    const data = record(await this.request(url, true));
    const movie = movieSummary(data);
    if (movie.tmdbId !== id)
      throw new BadGatewayException('TMDB movie id mismatch');
    return {
      ...movie,
      runtimeMinutes:
        Number.isSafeInteger(data.runtime) &&
        (data.runtime as number) > 0 &&
        (data.runtime as number) <= 2_147_483_647
          ? (data.runtime as number)
          : null,
      posterPath: posterPath(data.poster_path),
    };
  }
}
