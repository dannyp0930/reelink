import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MovieViewingsController } from './movie-viewings/movie-viewings.controller';
import { MoviesController } from './movies/movies.controller';
import { TmdbService } from './movies/tmdb.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, MovieViewingsController, MoviesController],
  providers: [AppService, TmdbService],
})
export class AppModule {}
