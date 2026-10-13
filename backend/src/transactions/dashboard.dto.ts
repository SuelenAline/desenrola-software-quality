import { IsIn, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsIn(['day', 'week', 'month'])
  period: 'day' | 'week' | 'month';

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
