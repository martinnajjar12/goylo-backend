import { DatabaseService } from '../database/database.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('queries only invitations addressed to the user and requests they can approve', async () => {
    const invitationFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'invite-1' }]);
    const requestFindMany = jest.fn().mockResolvedValue([{ id: 'request-1' }]);
    const database = {
      teamInvitation: { findMany: invitationFindMany },
      competitionRequest: { findMany: requestFindMany },
    } as unknown as DatabaseService;
    const service = new NotificationsService(database);

    await expect(service.list('user-1')).resolves.toEqual({
      teamInvitations: [{ id: 'invite-1' }],
      matchRequests: [{ id: 'request-1' }],
    });
    expect(invitationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 'user-1', status: 'PENDING' },
      }),
    );
    expect(requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          match: { organizerId: 'user-1' },
        },
      }),
    );
  });
});
