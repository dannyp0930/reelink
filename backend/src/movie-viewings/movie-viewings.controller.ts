import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.metadata';
import { PrismaService } from '../prisma/prisma.service';

@Controller('viewings')
export class MovieViewingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.prisma.movieViewing.findMany({
      where: { userId: request.user!.id },
      orderBy: [{ watchedOn: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { movie: true },
    });
  }

  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const viewing = await this.prisma.movieViewing.findFirst({
      where: { id, userId: request.user!.id },
      include: { movie: true },
    });
    if (!viewing) throw new NotFoundException();
    return viewing;
  }
}
