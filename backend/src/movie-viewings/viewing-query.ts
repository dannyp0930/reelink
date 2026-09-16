import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { ratingToHalfStars } from './rating';

export function parseViewingQuery(query: Record<string, unknown>) {
  const fields = ['month', 'rating', 'sort', 'page', 'limit'];
  for (const [key, value] of Object.entries(query)) {
    if (
      !fields.includes(key) ||
      typeof value !== 'string' ||
      !value ||
      value.trim() !== value
    ) {
      throw new BadRequestException(
        'Provide supported query fields once, with non-empty values',
      );
    }
  }

  const integer = (
    field: 'page' | 'limit',
    fallback: number,
    maximum: number,
  ) => {
    const value = query[field];
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value as string) || Number(value) > maximum) {
      throw new BadRequestException(
        `${field} must be an integer from 1 to ${maximum}`,
      );
    }
    return Number(value);
  };
  const page = integer('page', 1, 1_000_000);
  const limit = integer('limit', 50, 100);
  const where: Prisma.MovieViewingWhereInput = {};

  if (query.month !== undefined) {
    const month = query.month as string;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) {
      throw new BadRequestException('month must be YYYY-MM (0001-01..9999-12)');
    }
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    where.watchedOn = { gte: start, lt: end };
  }

  if (query.rating === 'unrated') where.ratingHalfStars = null;
  else if (query.rating !== undefined && query.rating !== 'all') {
    const rating = query.rating as string;
    if (!/^[0-5](?:\.[05])?$/.test(rating)) {
      throw new BadRequestException(
        'rating must be all, unrated or 0 to 5 in increments of 0.5',
      );
    }
    try {
      where.ratingHalfStars = ratingToHalfStars(Number(rating));
    } catch (error) {
      if (error instanceof RangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  const sort = query.sort ?? 'newest';
  let orderBy: Prisma.MovieViewingOrderByWithRelationInput[];
  if (sort === 'newest') orderBy = [{ watchedOn: 'desc' }, { id: 'desc' }];
  else if (sort === 'rating')
    orderBy = [
      { ratingHalfStars: { sort: 'desc', nulls: 'last' } },
      { watchedOn: 'desc' },
      { id: 'desc' },
    ];
  else if (sort === 'oldest')
    orderBy = [
      { watchedOn: 'asc' },
      { watchedTime: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' },
    ];
  else throw new BadRequestException('sort must be newest, rating or oldest');

  return { where, orderBy, page, limit };
}
