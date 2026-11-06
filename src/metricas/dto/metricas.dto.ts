import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class FiltroMetricasDto {
  @ApiPropertyOptional({
    description: 'Divergências abertas a partir desta data (AAAA-MM-DD)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString()
  inicio?: string;

  @ApiPropertyOptional({
    description: 'Divergências abertas até esta data, inclusive (AAAA-MM-DD)',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsDateString()
  fim?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  setorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tipoId?: number;
}
