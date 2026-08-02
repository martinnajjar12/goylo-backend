import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetitionRequestStatus, MatchStatus, Prisma } from '@prisma/client';
import {
  BrowseMatchesDto,
  CompeteDto,
  CreateMatchDto,
  RecordMatchResultDto,
} from '../common/dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MatchesService {
  constructor(private readonly db: DatabaseService) {}
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
      query.radiusKm /
        (111.32 * Math.max(0.01, Math.cos((query.latitude * Math.PI) / 180))),
    );
    const latitudeMin = Math.max(-90, query.latitude - latitudeDelta);
    const latitudeMax = Math.min(90, query.latitude + latitudeDelta);
    const longitudeMin = query.longitude - longitudeDelta;
    const longitudeMax = query.longitude + longitudeDelta;
    const longitudeFilter =
      longitudeDelta >= 180
        ? Prisma.empty
        : longitudeMin < -180
          ? Prisma.sql`AND ("longitude" >= ${longitudeMin + 360} OR "longitude" <= ${longitudeMax})`
          : longitudeMax > 180
            ? Prisma.sql`AND ("longitude" >= ${longitudeMin} OR "longitude" <= ${longitudeMax - 360})`
            : Prisma.sql`AND "longitude" BETWEEN ${longitudeMin} AND ${longitudeMax}`;
    const nearest = await this.db.$queryRaw<
      Array<{ id: string; distanceKm: number }>
    >(Prisma.sql`
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
      where: { id: { in: nearest.map((match) => match.id) } },
      include: {
        homeTeam: true,
        awayTeam: true,
        organizer: { select: { displayName: true } },
        _count: { select: { requests: true } },
      },
    });
    const matchesById = new Map(matches.map((match) => [match.id, match]));
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
          { homeTeam: { members: { some: { footballerId: userId } } } },
          { awayTeam: { members: { some: { footballerId: userId } } } },
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
  async details(userId: string, id: string) {
    const match = await this.db.match.findUnique({
      where: { id },
      include: {
        homeTeam: {
          include: {
            members: {
              include: {
                footballer: {
                  select: { id: true, displayName: true, position: true },
                },
              },
            },
          },
        },
        awayTeam: {
          include: {
            members: {
              include: {
                footballer: {
                  select: { id: true, displayName: true, position: true },
                },
              },
            },
          },
        },
        goals: {
          include: {
            scorer: { select: { id: true, displayName: true } },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        organizer: { select: { displayName: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    const participantIds = [
      ...match.homeTeam.members.map((member) => member.footballerId),
      ...(match.awayTeam?.members.map((member) => member.footballerId) ?? []),
    ];
    if (match.organizerId !== userId && !participantIds.includes(userId))
      throw new ForbiddenException(
        'Only participating teams can view match details',
      );
    return {
      ...match,
      canRecordResult:
        match.organizerId === userId &&
        !!match.awayTeam &&
        match.startsAt <= new Date(),
    };
  }
  async recordResult(userId: string, id: string, dto: RecordMatchResultDto) {
    const match = await this.db.match.findUnique({
      where: { id },
      include: {
        homeTeam: { include: { members: true } },
        awayTeam: { include: { members: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.organizerId !== userId)
      throw new ForbiddenException(
        'Only the match organizer can record the result',
      );
    if (!match.awayTeam || !['CONFIRMED', 'COMPLETED'].includes(match.status))
      throw new BadRequestException('A confirmed opponent is required');
    if (match.startsAt > new Date())
      throw new BadRequestException(
        'The result can only be recorded after the match starts',
      );
    const membersByTeam = new Map([
      [
        match.homeTeamId,
        new Set(match.homeTeam.members.map((member) => member.footballerId)),
      ],
      [
        match.awayTeamId!,
        new Set(match.awayTeam.members.map((member) => member.footballerId)),
      ],
    ]);
    for (const goal of dto.goals) {
      if (!membersByTeam.get(goal.teamId)?.has(goal.scorerId))
        throw new BadRequestException(
          'Every scorer must belong to the selected participating team',
        );
    }
    const homeScore = dto.goals.filter(
      (goal) => goal.teamId === match.homeTeamId,
    ).length;
    const awayScore = dto.goals.filter(
      (goal) => goal.teamId === match.awayTeamId,
    ).length;
    return this.db.$transaction(async (tx) => {
      await tx.matchGoal.deleteMany({ where: { matchId: id } });
      if (dto.goals.length)
        await tx.matchGoal.createMany({
          data: dto.goals.map((goal) => ({ ...goal, matchId: id })),
        });
      return tx.match.update({
        where: { id },
        data: { homeScore, awayScore, status: MatchStatus.COMPLETED },
      });
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
    return this.db.$transaction(async (tx) => {
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
