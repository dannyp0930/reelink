import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('cinemas')
export class CinemasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('q') query: unknown) {
    if (
      query !== undefined &&
      (typeof query !== 'string' ||
        query.trim().length > 100 ||
        // eslint-disable-next-line no-control-regex -- Reject control characters at the input boundary.
        /[\u0000-\u001f\u007f]/.test(query))
    ) {
      throw new BadRequestException(
        'q must be at most 100 characters without control characters',
      );
    }
    const text = typeof query === 'string' ? query.trim() : '';
    // Historical viewings may reference closed cinemas too.
    return this.prisma.cinema.findMany({
      where: text
        ? {
            name: {
              contains: text.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive',
            },
          }
        : {},
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 50,
      select: {
        id: true,
        name: true,
        chain: true,
        status: true,
        address: true,
      },
    });
  }
}
