import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetMaxActiveListingsDto {
  /** null скидає до типового ліміту (SettingsService.getMaxActiveListingsPerUser). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  value?: number | null;
}
