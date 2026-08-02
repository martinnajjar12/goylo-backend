import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTournamentDto } from '../common/dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TournamentsService {
  constructor(private readonly db: DatabaseService) {}
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
