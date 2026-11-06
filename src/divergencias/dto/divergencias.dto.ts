import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginacaoDto } from '../../common/paginacao.dto.js';
import { StatusDivergencia } from '../../generated/prisma/enums.js';

export class CriarDivergenciasDto {
  @ApiProperty({ type: [Number], description: 'Notas marcadas como divergentes (até 200 por envio)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos uma nota' })
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  notaFiscalIds: number[];

  @ApiProperty()
  @IsInt()
  tipoId: number;

  @ApiProperty({ example: 'Valor da nota diferente do pedido 4512 (R$ 1.500,00).' })
  @IsString()
  @MinLength(5, { message: 'Descreva o que precisa ser ajustado' })
  @MaxLength(2000)
  descricao: string;

  @ApiProperty({ description: 'Usuário responsável pelo ajuste' })
  @IsInt()
  responsavelId: number;
}

const TEXTO = { min: 3, max: 4000 };

export class ResponderDivergenciaDto {
  @ApiProperty({ enum: ['JUSTIFICATIVA', 'CORRECAO'] })
  @IsIn(['JUSTIFICATIVA', 'CORRECAO'])
  tipo: 'JUSTIFICATIVA' | 'CORRECAO';

  @ApiProperty({ example: 'Nota cancelada e reemitida com o valor correto (NF 1240).' })
  @IsString()
  @MinLength(TEXTO.min, { message: 'Escreva a justificativa ou a correção' })
  @MaxLength(TEXTO.max)
  texto: string;
}

export class RepassarDivergenciaDto {
  @ApiProperty({ description: 'Novo responsável' })
  @IsInt()
  responsavelId: number;

  @ApiProperty({ example: 'Quem negociou esse pedido foi o setor de Compras.' })
  @IsString()
  @MinLength(TEXTO.min, { message: 'Explique o motivo do repasse' })
  @MaxLength(TEXTO.max)
  texto: string;
}

export class AceitarDivergenciaDto {
  @ApiPropertyOptional({ example: 'Conferido, obrigado.' })
  @IsOptional()
  @IsString()
  @MaxLength(TEXTO.max)
  texto?: string;
}

export class DevolverDivergenciaDto {
  @ApiProperty({ example: 'A carta de correção não resolve; precisa reemitir.' })
  @IsString()
  @MinLength(TEXTO.min, { message: 'Explique por que está devolvendo' })
  @MaxLength(TEXTO.max)
  texto: string;

  @ApiPropertyOptional({ description: 'Outro responsável; se omitido, volta para o último' })
  @IsOptional()
  @IsInt()
  responsavelId?: number;
}

export const ESCOPOS = ['minhas', 'solicitadas', 'todas'] as const;
export type Escopo = (typeof ESCOPOS)[number];

export class FiltroDivergenciasDto extends PaginacaoDto {
  @ApiPropertyOptional({
    enum: ESCOPOS,
    default: 'minhas',
    description: 'minhas = pendentes comigo; solicitadas = abertas por mim; todas = revisor/admin',
  })
  @IsOptional()
  @IsIn(ESCOPOS)
  escopo: Escopo = 'minhas';

  @ApiPropertyOptional({ enum: StatusDivergencia })
  @IsOptional()
  @IsIn(Object.values(StatusDivergencia))
  status?: StatusDivergencia;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  setorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  notaFiscalId?: number;
}
