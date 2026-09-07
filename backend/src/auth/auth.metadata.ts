import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums';

export const Public = () => SetMetadata('auth:public', true);
export const Roles = (...roles: UserRole[]) => SetMetadata('auth:roles', roles);
export type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: UserRole } | null;
};
