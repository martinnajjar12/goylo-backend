import { Body, ConflictException, Controller, Injectable, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService) {}
  private result(user: { id: string; email: string; displayName: string }) { return { accessToken: this.jwt.sign({ sub: user.id, email: user.email }), user }; }
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.footballer.findUnique({ where: { email } })) throw new ConflictException('Email is already registered');
    try {
      const user = await this.db.footballer.create({ data: { email, displayName: dto.displayName, position: dto.position, city: dto.city, passwordHash: await bcrypt.hash(dto.password, 12) }, select: { id: true, email: true, displayName: true } });
      return this.result(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email is already registered');
      throw error;
    }
  }
  async login(dto: LoginDto) {
    const user = await this.db.footballer.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.result(user);
  }
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() { super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: process.env.JWT_SECRET ?? 'development-only-secret' }); }
  validate(payload: { sub: string; email: string }) { return { id: payload.sub, email: payload.email }; }
}
@Controller('auth')
export class AuthController { constructor(private service: AuthService) {} @Post('register') register(@Body() dto: RegisterDto) { return this.service.register(dto); } @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto); } }
