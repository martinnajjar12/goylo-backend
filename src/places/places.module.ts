import { Module } from '@nestjs/common';
import { GooglePlacesController } from './places.controller';
import { GooglePlacesService } from './places.service';

@Module({
  controllers: [GooglePlacesController],
  providers: [GooglePlacesService],
})
export class PlacesModule {}
