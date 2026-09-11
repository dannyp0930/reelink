import { BadRequestException } from '@nestjs/common';
import type { ViewingType } from '../generated/prisma/client';
import { ratingToHalfStars } from './rating';

type ViewingInput = {
  movieId: string;
  watchedOn: Date;
  watchedTime?: string | null;
  viewingType?: ViewingType | null;
  cinemaId?: string | null;
  auditorium?: string | null;
  screeningFormat?: string | null;
  streamingService?: string | null;
  viewingDetail?: string | null;
  ratingHalfStars?: number | null;
  note?: string | null;
};

const fields = [
  'movieId',
  'watchedOn',
  'watchedTime',
  'viewingType',
  'cinemaId',
  'auditorium',
  'screeningFormat',
  'streamingService',
  'viewingDetail',
  'rating',
  'note',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !uuid.test(value)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return value;
}

function readDate(value: unknown): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  ) {
    throw new BadRequestException('watchedOn must be a valid YYYY-MM-DD date');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('watchedOn must be a valid YYYY-MM-DD date');
  }
  return date;
}

function readText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    value.includes('\0')
  ) {
    throw new BadRequestException(
      `${field} must be null or text of at most ${maxLength} characters without NUL`,
    );
  }
  return value;
}

export function parseViewingInput(body: unknown, mode: 'create'): ViewingInput;
export function parseViewingInput(
  body: unknown,
  mode: 'patch',
): Partial<ViewingInput>;
export function parseViewingInput(
  body: unknown,
  mode: 'create' | 'patch',
): Partial<ViewingInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('A JSON object is required');
  }
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length === 0 || keys.some((key) => !fields.includes(key))) {
    throw new BadRequestException(
      'Provide at least one supported viewing field',
    );
  }
  const data: Partial<ViewingInput> = {};
  if (mode === 'create' || Object.hasOwn(input, 'movieId'))
    data.movieId = readId(input.movieId, 'movieId');
  if (mode === 'create' || Object.hasOwn(input, 'watchedOn'))
    data.watchedOn = readDate(input.watchedOn);
  if (Object.hasOwn(input, 'watchedTime')) {
    const value = input.watchedTime;
    if (
      value !== null &&
      (typeof value !== 'string' ||
        value.length !== 5 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    )
      throw new BadRequestException(
        'watchedTime must be null or HH:mm (00:00..23:59)',
      );
    data.watchedTime = value;
  }
  if (Object.hasOwn(input, 'viewingType')) {
    const value = input.viewingType;
    if (
      value !== null &&
      value !== 'THEATER' &&
      value !== 'STREAMING' &&
      value !== 'OTHER'
    )
      throw new BadRequestException(
        'viewingType must be null, THEATER, STREAMING or OTHER',
      );
    data.viewingType = value;
  }
  for (const [field, limit] of [
    ['screeningFormat', 50],
    ['streamingService', 80],
    ['viewingDetail', 200],
  ] as const) {
    if (Object.hasOwn(input, field))
      data[field] = readText(input[field], field, limit);
  }
  if (Object.hasOwn(input, 'cinemaId'))
    data.cinemaId =
      input.cinemaId === null ? null : readId(input.cinemaId, 'cinemaId');
  if (Object.hasOwn(input, 'auditorium'))
    data.auditorium = readText(input.auditorium, 'auditorium', 100);
  if (Object.hasOwn(input, 'note'))
    data.note = readText(input.note, 'note', 5000);
  if (Object.hasOwn(input, 'rating')) {
    try {
      data.ratingHalfStars = ratingToHalfStars(input.rating);
    } catch (error) {
      if (error instanceof RangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
  return data;
}

export function resolveViewingContext<T extends Partial<ViewingInput>>(
  input: T,
  currentType: ViewingType | null = null,
): T {
  const data = { ...input };
  const explicit = input.viewingType !== undefined;
  const type = explicit
    ? input.viewingType
    : (currentType ?? (input.cinemaId ? 'THEATER' : null));
  if (explicit || type !== currentType) data.viewingType = type;
  const groups = [
    ['THEATER', ['cinemaId', 'auditorium', 'screeningFormat']],
    ['STREAMING', ['streamingService']],
    ['OTHER', ['viewingDetail']],
  ] as const;
  for (const [allowedType, keys] of groups) {
    if (type === allowedType) continue;
    for (const key of keys) {
      // Legacy clients/records may have auditorium text without a known type.
      if (!explicit && type === null && key === 'auditorium') continue;
      if (input[key] !== undefined && input[key] !== null)
        throw new BadRequestException(
          `${key} requires viewingType ${allowedType}`,
        );
      if (explicit) data[key] = null;
    }
  }
  return data;
}
