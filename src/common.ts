import { createParamDecorator, ExecutionContext, UseGuards, applyDecorators } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
export type AuthUser = { id: string; email: string };
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
export const Auth = () => applyDecorators(UseGuards(AuthGuard('jwt')), ApiBearerAuth());
