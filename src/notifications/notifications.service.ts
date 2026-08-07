import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string) {
    const [teamInvitations, matchRequests] = await Promise.all([
      this.db.teamInvitation.findMany({
        where: { recipientId: userId, status: 'PENDING' },
        select: {
          id: true,
          createdAt: true,
          team: { select: { id: true, name: true } },
          sender: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.competitionRequest.findMany({
        where: {
          status: 'PENDING',
          match: { organizerId: userId },
        },
        select: {
          id: true,
          createdAt: true,
          challengerTeam: { select: { id: true, name: true } },
          match: {
            select: {
              id: true,
              startsAt: true,
              venue: true,
              homeTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { teamInvitations, matchRequests };
  }
}
