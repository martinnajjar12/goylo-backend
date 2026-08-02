import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma.service';
import { AuthController, AuthService, JwtStrategy } from './auth';
import { FootballersController, GooglePlacesController, TeamsController, MatchesController, TournamentsController } from './controllers';
import { GooglePlacesService, TeamsService, MatchesService, TournamentsService } from './services';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PassportModule, JwtModule.register({ global: true, secret: process.env.JWT_SECRET ?? 'development-only-secret', signOptions: { expiresIn: '7d' } })],
  controllers: [AuthController, FootballersController, TeamsController, MatchesController, GooglePlacesController, TournamentsController],
  providers: [PrismaService, AuthService, JwtStrategy, TeamsService, MatchesService, GooglePlacesService, TournamentsService],
})
export class AppModule {}
