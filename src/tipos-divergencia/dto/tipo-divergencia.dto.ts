import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarTipoDivergenciaDto {
  @ApiProperty({ example: 'Sem pedido de compra' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiPropertyOptional({ description: 'Setor de origem do motivo (Suprimentos, Fiscal, Financeiro...)' })
  @IsOptional()
  @IsInt()
  setorOrigemId?: number;
}

export class AtualizarTipoDivergenciaDto {
  @ApiPropertyOptional({ example: 'Sem pedido de compra' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  setorOrigemId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
