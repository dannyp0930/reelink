import type { Prisma } from '../generated/prisma/client';

export function posterPath(value: unknown): string | null {
  return typeof value === 'string' &&
    value === value.trim() &&
    /^\/[a-zA-Z0-9_-]{1,200}\.(jpg|png)$/.test(value)
    ? value
    : null;
}

export function posterUrl(value: unknown): string | null {
  const path = posterPath(value);
  return path ? `https://image.tmdb.org/t/p/w154${path}` : null;
}

export const movieSelect = {
  id: true,
  title: true,
  originalTitle: true,
  releaseDate: true,
  runtimeMinutes: true,
  posterPath: true,
} satisfies Prisma.MovieSelect;

export function movieResponse(
  movie: Prisma.MovieGetPayload<{ select: typeof movieSelect }>,
) {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    releaseDate: movie.releaseDate,
    runtimeMinutes: movie.runtimeMinutes,
    posterUrl: posterUrl(movie.posterPath),
  };
}
