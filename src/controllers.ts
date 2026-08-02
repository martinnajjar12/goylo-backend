import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Auth, AuthUser, CurrentUser } from './common';
import { CompetitionDecisionDto, CompeteDto, CreateMatchDto, CreateTeamDto, CreateTournamentDto, InvitationDecisionDto, InviteDto, UpdateProfileDto } from './dto';
import { MatchesService, TeamsService, TournamentsService } from './services';

@Auth() @Controller('footballers')
export class FootballersController { constructor(private db: PrismaService) {} @Get('me') me(@CurrentUser() u: AuthUser) { return this.db.footballer.findUnique({ where: { id: u.id }, select: { id: true, email: true, displayName: true, position: true, city: true, createdAt: true } }); } @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.db.footballer.update({ where: { id: u.id }, data: dto, select: { id: true, email: true, displayName: true, position: true, city: true } }); } }
@Auth() @Controller('teams')
export class TeamsController { constructor(private s: TeamsService) {} @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateTeamDto) { return this.s.create(u.id, d); } @Get('mine') list(@CurrentUser() u: AuthUser) { return this.s.list(u.id); } @Post(':id/invitations') invite(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: InviteDto) { return this.s.invite(u.id, id, d.email); } @Get('invitations/mine') invitations(@CurrentUser() u: AuthUser) { return this.s.invitations(u.id); } @Patch('invitations/:id') decide(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: InvitationDecisionDto) { return this.s.decide(u.id, id, d.status); } }
@Auth() @Controller('matches')
export class MatchesController { constructor(private s: MatchesService) {} @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateMatchDto) { return this.s.create(u.id, d); } @Get('browse') browse(@CurrentUser() u: AuthUser) { return this.s.browse(u.id); } @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.s.mine(u.id); } @Post(':id/requests') compete(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CompeteDto) { return this.s.compete(u.id, id, d); } @Patch(':matchId/requests/:requestId') decide(@CurrentUser() u: AuthUser, @Param('matchId') m: string, @Param('requestId') r: string, @Body() d: CompetitionDecisionDto) { return this.s.decide(u.id, m, r, d.status); } }
@Auth() @Controller('tournaments')
export class TournamentsController { constructor(private s: TournamentsService) {} @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateTournamentDto) { return this.s.create(u.id, d); } @Get() list() { return this.s.list(); } @Get(':id') one(@Param('id') id: string) { return this.s.one(id); } }
