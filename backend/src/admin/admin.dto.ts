import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class AdminUsersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string;
}

export class AccountStatusDto {
  @IsBoolean()
  active: boolean;
}

export class ActivitiesQuery {
  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{0,9}$/)
  before?: string;
}
