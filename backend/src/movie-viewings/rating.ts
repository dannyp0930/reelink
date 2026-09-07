// Validate before Prisma: its integer input can silently truncate fractions.
export function ratingToHalfStars(rating: unknown): number | null {
  if (rating === null) return null;
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating * 2) ||
    rating < 0 ||
    rating > 5
  ) {
    throw new RangeError('Rating must be null or 0 to 5 in increments of 0.5');
  }
  return rating * 2;
}
