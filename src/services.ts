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
  Prisma,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  CompeteDto,
  CreateMatchDto,
  BrowseMatchesDto,
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
  details(userId: string, id: string) {
    return this.db.team.findFirstOrThrow({
      where: { id, members: { some: { footballerId: userId } } },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
          include: {
            footballer: {
              select: { id: true, displayName: true, position: true },
            },
          },
        },
      },
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
  async browse(_userId: string, query: BrowseMatchesDto) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Restrict candidates with an index-friendly bounding box before applying
    // the exact Haversine distance in PostgreSQL.
    const latitudeDelta = query.radiusKm / 111.32;
    const longitudeDelta = Math.min(
      180,
      query.radiusKm / (111.32 * Math.max(0.01, Math.cos(query.latitude * Math.PI / 180))),
    );
    const latitudeMin = Math.max(-90, query.latitude - latitudeDelta);
    const latitudeMax = Math.min(90, query.latitude + latitudeDelta);
    const longitudeMin = query.longitude - longitudeDelta;
    const longitudeMax = query.longitude + longitudeDelta;
    const longitudeFilter = longitudeDelta >= 180
      ? Prisma.empty
      : longitudeMin < -180
        ? Prisma.sql`AND ("longitude" >= ${longitudeMin + 360} OR "longitude" <= ${longitudeMax})`
        : longitudeMax > 180
          ? Prisma.sql`AND ("longitude" >= ${longitudeMin} OR "longitude" <= ${longitudeMax - 360})`
          : Prisma.sql`AND "longitude" BETWEEN ${longitudeMin} AND ${longitudeMax}`;
    const nearest = await this.db.$queryRaw<Array<{ id: string; distanceKm: number }>>(Prisma.sql`
      WITH candidates AS (
        SELECT "id", 6371 * 2 * ASIN(LEAST(1, SQRT(
          POWER(SIN(RADIANS("latitude" - ${query.latitude}) / 2), 2) +
          COS(RADIANS(${query.latitude})) * COS(RADIANS("latitude")) *
          POWER(SIN(RADIANS("longitude" - ${query.longitude}) / 2), 2)
        ))) AS "distanceKm"
        FROM "Match"
        WHERE "latitude" BETWEEN ${latitudeMin} AND ${latitudeMax}
          ${longitudeFilter}
          AND "status" IN ('OPEN'::"MatchStatus", 'CONFIRMED'::"MatchStatus")
          AND "startsAt" >= ${yesterday}
      )
      SELECT "id", "distanceKm"
      FROM candidates
      WHERE "distanceKm" <= ${query.radiusKm}
      ORDER BY "distanceKm" ASC
      LIMIT ${query.limit ?? 50}
    `);
    if (!nearest.length) return [];
    const matches = await this.db.match.findMany({
      where: { id: { in: nearest.map(match => match.id) } },
      include: {
        homeTeam: true,
        awayTeam: true,
        organizer: { select: { displayName: true } },
        _count: { select: { requests: true } },
      },
    });
    const matchesById = new Map(matches.map(match => [match.id, match]));
    return nearest.flatMap(({ id, distanceKm }) => {
      const match = matchesById.get(id);
      return match ? [{ ...match, distanceKm }] : [];
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
export class GooglePlacesService {
  private readonly baseUrl = 'https://places.googleapis.com/v1';
  private get apiKey() {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new BadRequestException('Google Places is not configured');
    return key;
  }
  async autocomplete(input: string) {
    const response = await fetch(`${this.baseUrl}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({ input }),
    });
    return this.readResponse(response);
  }
  async details(placeId: string) {
    const fields = 'id,displayName,formattedAddress,location,addressComponents,googleMapsUri';
    const response = await fetch(`${this.baseUrl}/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fields)}`, {
      headers: { 'X-Goog-Api-Key': this.apiKey },
    });
    return this.readResponse(response);
  }
  private async readResponse(response: Response) {
    const body = await response.json() as any;
    if (!response.ok) throw new BadRequestException(body.error?.message ?? 'Google Places request failed');
    return body;
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
