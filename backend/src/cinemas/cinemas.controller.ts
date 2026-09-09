import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('cinemas')
export class CinemasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    // Historical viewings may reference closed cinemas too.
    return this.prisma.cinema.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, chain: true, status: true },
    });
  }
}
