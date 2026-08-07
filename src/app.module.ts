import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FootballersModule } from './footballers/footballers.module';
import { MatchesModule } from './matches/matches.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlacesModule } from './places/places.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'development-only-secret',
      signOptions: { expiresIn: '7d' },
    }),
    DatabaseModule,
    AuthModule,
    FootballersModule,
    TeamsModule,
    MatchesModule,
    NotificationsModule,
    PlacesModule,
    TournamentsModule,
  ],
})
export class AppModule {}
