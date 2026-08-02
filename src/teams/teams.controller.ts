import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.decorators';
import { CreateTeamDto, InvitationDecisionDto, InviteDto } from '../common/dto';
import { TeamsService } from './teams.service';

@Auth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(user.id, dto);
  }
  @Get('mine') list(@CurrentUser() user: AuthUser) {
    return this.teamsService.list(user.id);
  }
  @Get(':id') details(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teamsService.details(user.id, id);
  }
  @Post(':id/invitations') invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteDto,
  ) {
    return this.teamsService.invite(user.id, id, dto.email);
  }
  @Get('invitations/mine') invitations(@CurrentUser() user: AuthUser) {
    return this.teamsService.invitations(user.id);
  }
  @Patch('invitations/:id') decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InvitationDecisionDto,
  ) {
    return this.teamsService.decide(user.id, id, dto.status);
  }
}
