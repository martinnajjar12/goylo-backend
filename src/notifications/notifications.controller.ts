import { Controller, Get } from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.decorators';
import { NotificationsService } from './notifications.service';

@Auth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notificationsService.list(user.id);
  }
}
