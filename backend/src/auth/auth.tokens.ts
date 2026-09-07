import { createHash, randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const isToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

// Only our unencoded base64url tokens are accepted, including duplicate rejection.
export function readTokenCookie(header: string | undefined, name: string) {
  const matches = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  const value = matches[0]?.slice(name.length + 1);
  return matches.length === 1 && isToken(value) ? value : undefined;
}
