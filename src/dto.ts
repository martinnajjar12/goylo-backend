import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  CompetitionRequestStatus,
  InvitationStatus,
  TournamentStatus,
} from '@prisma/client';
export class RegisterDto {
  @IsEmail() email!: string;
  @MinLength(8) password!: string;
  @IsString() displayName!: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() city?: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() city?: string;
}
export class CreateTeamDto {
  @IsString() name!: string;
  @IsString() city!: string;
  @IsOptional() @IsString() description?: string;
}
export class InviteDto {
  @IsEmail() email!: string;
}
export class InvitationDecisionDto {
  @IsEnum(InvitationStatus) status!: InvitationStatus;
}
export class CreateMatchDto {
  @IsString() venue!: string;
  @IsString() city!: string;
  @IsInt() @Min(3) @Max(11) playersPerTeam!: number;
  @IsOptional() @IsUrl({ require_protocol: true }) mapUrl?: string;
  @IsDateString() startsAt!: string;
  @IsString() homeTeamId!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() tournamentId?: string;
}
export class CompeteDto {
  @IsString() challengerTeamId!: string;
  @IsOptional() @IsString() message?: string;
}
export class CompetitionDecisionDto {
  @IsEnum(CompetitionRequestStatus) status!: CompetitionRequestStatus;
}
export class CreateTournamentDto {
  @IsString() name!: string;
  @IsString() city!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TournamentStatus) status?: TournamentStatus;
}
