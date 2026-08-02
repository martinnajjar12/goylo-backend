import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus } from '@prisma/client';
import { CreateTeamDto } from '../common/dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TeamsService {
  constructor(private readonly db: DatabaseService) {}
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
    return this.db.$transaction(async (tx) => {
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
