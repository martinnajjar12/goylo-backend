import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.decorators';
import { UpdateProfileDto } from '../common/dto';
import { DatabaseService } from '../database/database.service';

@Auth()
@Controller('footballers')
export class FootballersController {
  constructor(private readonly db: DatabaseService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.db.footballer.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        position: true,
        city: true,
        createdAt: true,
      },
    });
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.db.footballer.update({
      where: { id: user.id },
      data: dto,
      select: {
        id: true,
        email: true,
        displayName: true,
        position: true,
        city: true,
      },
    });
  }
}
