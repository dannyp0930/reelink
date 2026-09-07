import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MovieViewingsController } from './movie-viewings/movie-viewings.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, MovieViewingsController],
  providers: [AppService],
})
export class AppModule {}
