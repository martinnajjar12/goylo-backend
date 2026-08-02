import { Module } from '@nestjs/common';
import { FootballersController } from './footballers.controller';

@Module({ controllers: [FootballersController] })
export class FootballersModule {}
