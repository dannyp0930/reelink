import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MovieViewingsController } from './movie-viewings/movie-viewings.controller';
import { MoviesController } from './movies/movies.controller';
import { TmdbService } from './movies/tmdb.service';
import { CinemasController } from './cinemas/cinemas.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AppController,
    MovieViewingsController,
    MoviesController,
    CinemasController,
  ],
  providers: [AppService, TmdbService],
})
export class AppModule {}
