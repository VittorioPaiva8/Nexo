import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarSetorDto {
  @ApiProperty({ example: 'Compras' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome: string;
}

export class AtualizarSetorDto {
  @ApiPropertyOptional({ example: 'Compras' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
