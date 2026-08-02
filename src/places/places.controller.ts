import { Controller, Get, Param, Query } from '@nestjs/common';
import { Auth } from '../common/auth.decorators';
import { GooglePlacesService } from './places.service';

@Auth()
@Controller('places')
export class GooglePlacesController {
  constructor(private readonly placesService: GooglePlacesService) {}
  @Get('autocomplete') autocomplete(@Query('input') input: string) {
    return input?.trim()
      ? this.placesService.autocomplete(input.trim())
      : { suggestions: [] };
  }
  @Get(':placeId') details(@Param('placeId') placeId: string) {
    return this.placesService.details(placeId);
  }
}
