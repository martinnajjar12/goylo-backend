import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionRequestStatus,
  InvitationStatus,
  MatchStatus,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  CompeteDto,
  CreateMatchDto,
  CreateTeamDto,
  CreateTournamentDto,
} from './dto';

@Injectable()
export class TeamsService {
  constructor(private db: PrismaService) {}
  create(userId: string, dto: CreateTeamDto) {
    return this.db.team.create({
      data: {
        ...dto,
        ownerId: userId,
        members: { create: { footballerId: userId, role: 'OWNER' } },
      },
      include: {
        members: {
          include: {
            footballer: {
              select: { id: true, displayName: true, position: true },
            },
          },
        },
      },
    });
  }
  list(userId: string) {
    return this.db.team.findMany({
      where: { members: { some: { footballerId: userId } } },
      include: { _count: { select: { members: true } } },
    });
  }
  async invite(userId: string, teamId: string, email: string) {
    const team = await this.owned(userId, teamId);
    const recipient = await this.db.footballer.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!recipient) throw new NotFoundException('Footballer not found');
    if (recipient.id === userId)
      throw new BadRequestException('You are already the owner');
    try {
      return await this.db.teamInvitation.create({
        data: { teamId: team.id, senderId: userId, recipientId: recipient.id },
        include: { team: true, sender: { select: { displayName: true } } },
      });
    } catch {
      throw new ConflictException('Footballer was already invited');
    }
  }
  invitations(userId: string) {
    return this.db.teamInvitation.findMany({
      where: { recipientId: userId, status: 'PENDING' },
      include: { team: true, sender: { select: { displayName: true } } },
    });
  }
  async decide(userId: string, id: string, status: InvitationStatus) {
    if (status === 'PENDING')
      throw new BadRequestException('Choose ACCEPTED or REJECTED');
    const invite = await this.db.teamInvitation.findFirst({
      where: { id, recipientId: userId, status: 'PENDING' },
    });
    if (!invite) throw new NotFoundException('Pending invitation not found');
    return this.db.$transaction(async tx => {
      const updated = await tx.teamInvitation.update({
        where: { id },
        data: { status, respondedAt: new Date() },
      });
      if (status === 'ACCEPTED')
        await tx.teamMember.create({
          data: { teamId: invite.teamId, footballerId: userId },
        });
      return updated;
    });
  }
  private async owned(userId: string, id: string) {
    const team = await this.db.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerId !== userId)
      throw new ForbiddenException('Only the team owner can do this');
    return team;
  }
}

@Injectable()
export class MatchesService {
  constructor(private db: PrismaService) {}
  async create(userId: string, dto: CreateMatchDto) {
    await this.assertOwner(userId, dto.homeTeamId);
    if (dto.tournamentId) {
      const t = await this.db.tournament.findUnique({
        where: { id: dto.tournamentId },
      });
      if (!t || t.organizerId !== userId)
        throw new ForbiddenException('You do not own this tournament');
    }
    return this.db.match.create({
      data: { ...dto, startsAt: new Date(dto.startsAt), organizerId: userId },
      include: { homeTeam: true, tournament: true },
    });
  }
  browse(_userId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    return this.db.match.findMany({
      where: {
        status: { in: [MatchStatus.OPEN, MatchStatus.CONFIRMED] },
        startsAt: { gte: yesterday },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        organizer: { select: { displayName: true } },
        _count: { select: { requests: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }
  mine(userId: string) {
    return this.db.match.findMany({
      where: {
        OR: [
          { organizerId: userId },
          { requests: { some: { challengerId: userId } } },
        ],
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        requests: {
          include: {
            challengerTeam: true,
            challenger: { select: { displayName: true } },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }
  async compete(userId: string, matchId: string, dto: CompeteDto) {
    const match = await this.db.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== 'OPEN')
      throw new NotFoundException('Open match not found');
    if (match.organizerId === userId)
      throw new BadRequestException('You cannot challenge your own match');
    await this.assertOwner(userId, dto.challengerTeamId);
    if (dto.challengerTeamId === match.homeTeamId)
      throw new BadRequestException('Choose another team');
    try {
      return await this.db.competitionRequest.create({
        data: { ...dto, matchId, challengerId: userId },
        include: { challengerTeam: true },
      });
    } catch {
      throw new ConflictException('This team has already requested the match');
    }
  }
  async decide(
    userId: string,
    matchId: string,
    requestId: string,
    status: CompetitionRequestStatus,
  ) {
    if (status === 'PENDING')
      throw new BadRequestException('Choose APPROVED or REJECTED');
    const match = await this.db.match.findUnique({ where: { id: matchId } });
    if (!match || match.organizerId !== userId)
      throw new ForbiddenException('Only the match organizer can decide');
    const request = await this.db.competitionRequest.findFirst({
      where: { id: requestId, matchId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Pending request not found');
    return this.db.$transaction(async tx => {
      const updated = await tx.competitionRequest.update({
        where: { id: requestId },
        data: { status, respondedAt: new Date() },
      });
      if (status === 'APPROVED') {
        await tx.match.update({
          where: { id: matchId },
          data: {
            awayTeamId: request.challengerTeamId,
            status: MatchStatus.CONFIRMED,
          },
        });
        await tx.competitionRequest.updateMany({
          where: { matchId, id: { not: requestId }, status: 'PENDING' },
          data: { status: 'REJECTED', respondedAt: new Date() },
        });
      }
      return updated;
    });
  }
  private async assertOwner(userId: string, teamId: string) {
    const team = await this.db.team.findUnique({ where: { id: teamId } });
    if (!team || team.ownerId !== userId)
      throw new ForbiddenException('You must own this team');
  }
}

@Injectable()
export class TournamentsService {
  constructor(private db: PrismaService) {}
  create(userId: string, dto: CreateTournamentDto) {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('End must be after start');
    return this.db.tournament.create({
      data: {
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        organizerId: userId,
      },
    });
  }
  list() {
    return this.db.tournament.findMany({
      include: {
        organizer: { select: { displayName: true } },
        matches: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }
  async one(id: string) {
    const value = await this.db.tournament.findUnique({
      where: { id },
      include: {
        organizer: { select: { displayName: true } },
        matches: { include: { homeTeam: true, awayTeam: true } },
      },
    });
    if (!value) throw new NotFoundException('Tournament not found');
    return value;
  }
}
