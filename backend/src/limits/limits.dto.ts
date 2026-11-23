import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class SpendingLimitDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  categoryId: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(1900)
  @Max(9998)
  year: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;
}
