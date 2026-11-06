import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarTipoDivergenciaDto {
  @ApiProperty({ example: 'Valor divergente do pedido' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;
}

export class AtualizarTipoDivergenciaDto {
  @ApiPropertyOptional({ example: 'Valor divergente do pedido' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
