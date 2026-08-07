import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, TeamRole } from '@prisma/client';
import { CreateTeamDto, TeamSquadPlacementDto } from '../common/dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TeamsService {
  constructor(private readonly db: DatabaseService) {}
  create(userId: string, dto: CreateTeamDto) {
    return this.db.team.create({
      data: {
        ...dto,
        ownerId: userId,
        members: { create: { footballerId: userId, role: 'CAPTAIN' } },
      },
      include: {
        members: {
          include: {
            footballer: {
              select: { id: true, displayName: true, position: true },
            },
          },
        },
        squad: true,
      },
    });
  }
  list(userId: string) {
    return this.db.team.findMany({
      where: { members: { some: { footballerId: userId } } },
      include: { _count: { select: { members: true } } },
    });
  }
  async details(userId: string, id: string) {
    const team = await this.db.team.findFirstOrThrow({
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
        squad: true,
      },
    });
    const myRole = team.members.find(
      (member) => member.footballerId === userId,
    )?.role;
    return {
      ...team,
      myRole,
      canManage: team.ownerId === userId || myRole === 'CAPTAIN',
    };
  }
  async invite(userId: string, teamId: string, email: string) {
    const team = await this.managed(userId, teamId);
    const recipient = await this.db.footballer.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!recipient) throw new NotFoundException('Footballer not found');
    if (recipient.id === userId)
      throw new BadRequestException('You are already on this team');
    try {
      return await this.db.teamInvitation.create({
        data: {
          teamId: team.teamId,
          senderId: userId,
          recipientId: recipient.id,
        },
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
  async updateRole(
    userId: string,
    teamId: string,
    footballerId: string,
    role: TeamRole,
  ) {
    const manager = await this.managed(userId, teamId);
    if (manager.role === 'COACH')
      throw new ForbiddenException(
        'Only the captain can assign team leadership',
      );
    const member = await this.db.teamMember.findUnique({
      where: { teamId_footballerId: { teamId, footballerId } },
    });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.role === 'CAPTAIN' && role !== 'CAPTAIN')
      throw new BadRequestException(
        'Transfer captaincy to another member instead',
      );
    return this.db.$transaction(async (tx) => {
      if (role === 'CAPTAIN')
        await tx.teamMember.updateMany({
          where: { teamId, role: 'CAPTAIN' },
          data: { role: 'MEMBER' },
        });
      if (role === 'COACH')
        await tx.teamMember.updateMany({
          where: { teamId, role: 'COACH' },
          data: { role: 'MEMBER' },
        });
      return tx.teamMember.update({
        where: { teamId_footballerId: { teamId, footballerId } },
        data: { role },
      });
    });
  }
  async removeMember(userId: string, teamId: string, footballerId: string) {
    await this.managed(userId, teamId);
    const member = await this.db.teamMember.findUnique({
      where: { teamId_footballerId: { teamId, footballerId } },
    });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.role === 'CAPTAIN')
      throw new BadRequestException(
        'Transfer captaincy before removing the captain',
      );
    await this.db.$transaction(async (tx) => {
      await tx.teamSquadPlayer.deleteMany({ where: { teamId, footballerId } });
      await tx.matchSquadPlayer.deleteMany({ where: { teamId, footballerId } });
      await tx.teamMember.delete({
        where: { teamId_footballerId: { teamId, footballerId } },
      });
    });
    return { removed: true };
  }
  async updateSquad(
    userId: string,
    teamId: string,
    selectedIds: string[],
    placements: TeamSquadPlacementDto[] = [],
  ) {
    await this.assertCaptainOrOwner(userId, teamId);
    const footballerIds = [...new Set(selectedIds)];
    if (!footballerIds.length)
      throw new BadRequestException('Select at least one squad player');
    const members = await this.db.teamMember.count({
      where: { teamId, footballerId: { in: footballerIds } },
    });
    if (members !== footballerIds.length)
      throw new BadRequestException(
        'Every squad player must belong to the team',
      );
    const placementByPlayer = new Map(
      placements.map((placement) => [placement.footballerId, placement]),
    );
    if (
      placements.some(
        (placement) => !footballerIds.includes(placement.footballerId),
      )
    )
      throw new BadRequestException(
        'Only selected squad players can be placed',
      );
    return this.db.$transaction(async (tx) => {
      await tx.teamSquadPlayer.deleteMany({ where: { teamId } });
      await tx.teamSquadPlayer.createMany({
        data: footballerIds.map((footballerId) => {
          const placement = placementByPlayer.get(footballerId);
          return {
            teamId,
            footballerId,
            pitchX: placement?.pitchX,
            pitchY: placement?.pitchY,
          };
        }),
      });
      return tx.teamSquadPlayer.findMany({ where: { teamId } });
    });
  }
  private async managed(userId: string, id: string) {
    const member = await this.db.teamMember.findUnique({
      where: { teamId_footballerId: { teamId: id, footballerId: userId } },
    });
    if (!member || !['CAPTAIN', 'COACH'].includes(member.role))
      throw new ForbiddenException('Only the captain or coach can do this');
    return member;
  }
  private async assertCaptainOrOwner(userId: string, teamId: string) {
    const team = await this.db.team.findUnique({
      where: { id: teamId },
      include: { members: { where: { footballerId: userId } } },
    });
    if (
      !team ||
      (team.ownerId !== userId && team.members[0]?.role !== 'CAPTAIN')
    )
      throw new ForbiddenException(
        'Only the team owner or captain can set the default squad',
      );
  }
}
