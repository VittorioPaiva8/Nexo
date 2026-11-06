import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { IsDia } from '../../common/validadores.js';
import { Prioridade } from '../../generated/prisma/enums.js';

const vazio = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

/** Campos do formulário multipart que valem para as linhas sem setor/responsável/prazo. */
export class PadroesLoteDto {
  @ApiPropertyOptional({ description: 'Setor padrão do lote' })
  @IsOptional()
  @Transform(vazio)
  @Type(() => Number)
  @IsInt()
  setorId?: number;

  @ApiPropertyOptional({ description: 'Responsável padrão do lote' })
  @IsOptional()
  @Transform(vazio)
  @Type(() => Number)
  @IsInt()
  responsavelId?: number;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Prazo padrão (sem ele, usa o SLA do setor)' })
  @IsOptional()
  @Transform(vazio)
  @IsDia()
  prazo?: string;

  @ApiPropertyOptional({ enum: Prioridade })
  @IsOptional()
  @Transform(vazio)
  @IsEnum(Prioridade)
  prioridade?: Prioridade;
}
