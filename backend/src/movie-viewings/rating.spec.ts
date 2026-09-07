import { ratingToHalfStars } from './rating';

describe('ratingToHalfStars', () => {
  it('preserves every half-star and separates zero from unrated', () => {
    expect(ratingToHalfStars(null)).toBeNull();
    for (let units = 0; units <= 10; units++) {
      expect(ratingToHalfStars(units / 2)).toBe(units);
    }
  });

  it.each([
    -0.5,
    5.5,
    0.25,
    0.75,
    4.9,
    NaN,
    Infinity,
    -Infinity,
    '4.5',
    '',
    undefined,
    true,
    {},
  ])('rejects invalid rating %s without rounding', (rating) => {
    expect(() => ratingToHalfStars(rating)).toThrow(RangeError);
  });
});
