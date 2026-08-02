import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.decorators';
import {
  BrowseMatchesDto,
  CompetitionDecisionDto,
  CompeteDto,
  CreateMatchDto,
  RecordMatchResultDto,
} from '../common/dto';
import { MatchesService } from './matches.service';

@Auth()
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(user.id, dto);
  }
  @Get('browse') browse(
    @CurrentUser() user: AuthUser,
    @Query() query: BrowseMatchesDto,
  ) {
    return this.matchesService.browse(user.id, query);
  }
  @Get('mine') mine(@CurrentUser() user: AuthUser) {
    return this.matchesService.mine(user.id);
  }
  @Get(':id') details(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matchesService.details(user.id, id);
  }
  @Patch(':id/result') result(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordMatchResultDto,
  ) {
    return this.matchesService.recordResult(user.id, id, dto);
  }
  @Post(':id/requests') compete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompeteDto,
  ) {
    return this.matchesService.compete(user.id, id, dto);
  }
  @Patch(':matchId/requests/:requestId') decide(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('requestId') requestId: string,
    @Body() dto: CompetitionDecisionDto,
  ) {
    return this.matchesService.decide(user.id, matchId, requestId, dto.status);
  }
}
