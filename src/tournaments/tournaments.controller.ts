import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.decorators';
import { CreateTournamentDto } from '../common/dto';
import { TournamentsService } from './tournaments.service';

@Auth()
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(user.id, dto);
  }
  @Get() list() {
    return this.tournamentsService.list();
  }
  @Get(':id') one(@Param('id') id: string) {
    return this.tournamentsService.one(id);
  }
}
