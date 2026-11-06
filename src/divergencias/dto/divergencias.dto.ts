import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginacaoDto } from '../../common/paginacao.dto.js';
import { IsChaveAcesso, IsCnpj, IsDia } from '../../common/validadores.js';
import { Prioridade, StatusDivergencia } from '../../generated/prisma/enums.js';

const vazioParaUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Dados mínimos da NF no cadastro manual (manual, seção 11). */
export class NotaManualDto {
  @ApiProperty({ example: '000125' })
  @IsString()
  @Matches(/^\d{1,9}$/, { message: 'Número da NF deve ter até 9 dígitos' })
  numero: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'Série deve ter até 3 dígitos' })
  serie: string;

  @ApiPropertyOptional({ description: '44 dígitos, quando for NF-e' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsChaveAcesso()
  chaveAcesso?: string;

  @ApiProperty({ example: 'Materiais Alfa Ltda.' })
  @IsString()
  @MinLength(2, { message: 'Informe a razão social do fornecedor' })
  @MaxLength(150)
  emitenteNome: string;

  @ApiProperty({ example: '11.222.333/0001-81' })
  @IsCnpj()
  emitenteCnpj: string;

  @ApiProperty({ example: '10500.00', description: 'Valor total da NF' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Valor total inválido' })
  valorTotal: string;

  @ApiPropertyOptional({ example: '2026-11-05' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsDia()
  dataEmissao?: string;

  @ApiPropertyOptional({ description: 'CNPJ da unidade recebedora' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsString()
  @MaxLength(20)
  destinatarioDoc?: string;

  @ApiPropertyOptional({ example: 'PC-02861' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsString()
  @MaxLength(40)
  pedidoCompra?: string;

  @ApiPropertyOptional({ example: 'Cascavel' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsString()
  @MaxLength(80)
  unidade?: string;

  @ApiPropertyOptional({ example: '26.30' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsString()
  @MaxLength(40)
  centroCusto?: string;
}

export class CriarDivergenciaDto {
  @ApiPropertyOptional({
    type: [Number],
    description: 'Notas já importadas (XML) que recebem a mesma divergência. Use isto ou "nota".',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos uma nota' })
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  notaFiscalIds?: number[];

  @ApiPropertyOptional({ type: NotaManualDto, description: 'Cadastro manual da nota' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotaManualDto)
  nota?: NotaManualDto;

  @ApiProperty()
  @IsInt({ message: 'Escolha o tipo de divergência' })
  tipoId: number;

  @ApiProperty({ description: 'Setor responsável pela correção' })
  @IsInt({ message: 'Escolha o setor responsável' })
  setorId: number;

  @ApiProperty({ description: 'Usuário do setor que vai tratar' })
  @IsInt({ message: 'Escolha o responsável' })
  responsavelId: number;

  @ApiPropertyOptional({ enum: Prioridade, default: 'NORMAL' })
  @IsOptional()
  @IsEnum(Prioridade)
  prioridade?: Prioridade;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Sem prazo, usa o SLA do setor' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsDia()
  prazo?: string;

  @ApiProperty({ example: 'Quantidade da NF (12) diferente do pedido (10). Ajustar o pedido.' })
  @IsString()
  @MinLength(10, { message: 'Descreva a divergência e a providência solicitada' })
  @MaxLength(4000)
  descricao: string;

  @ApiPropertyOptional({ example: '12 un', description: 'Valor/quantidade que veio na NF' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  valorNf?: string;

  @ApiPropertyOptional({ example: '10 un', description: 'Valor/quantidade esperado' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  valorEsperado?: string;

  @ApiPropertyOptional({ example: 'Corrigir o pedido para 12 unidades' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  correcaoEsperada?: string;
}

export class RascunhoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  texto: string;

  @ApiPropertyOptional({ example: 'Pedido de compra corrigido' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoSolucao?: string;
}

/** Enviado como multipart/form-data junto com as evidências (campo "arquivos"). */
export class DevolverDto {
  @ApiProperty({ example: 'Pedido ajustado de 10 para 12 unidades conforme NF e liberado.' })
  @IsString()
  @MinLength(10, { message: 'Descreva a ação realizada antes de devolver (mínimo 10 caracteres)' })
  @MaxLength(4000)
  texto: string;

  @ApiPropertyOptional({ example: 'Pedido de compra corrigido' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsString()
  @MaxLength(80)
  tipoSolucao?: string;
}

export class ConcluirDto {
  @ApiProperty({ example: 'Pedido conferido no ERP; lançamento liberado.' })
  @IsString()
  @MinLength(3, { message: 'Registre o parecer do Fiscal' })
  @MaxLength(4000)
  parecer: string;
}

export class ReabrirDto {
  @ApiProperty({ example: 'O valor unitário ainda não confere com a NF.' })
  @IsString()
  @MinLength(5, { message: 'Informe o motivo da reabertura' })
  @MaxLength(4000)
  motivo: string;

  @ApiPropertyOptional({ description: 'Outro responsável do mesmo setor; se omitido, volta ao último' })
  @IsOptional()
  @IsInt()
  responsavelId?: number;

  @ApiPropertyOptional({ example: '2026-11-10', description: 'Novo prazo; o anterior fica no histórico' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsDia()
  prazo?: string;
}

export class RedistribuirDto {
  @ApiPropertyOptional({ description: 'Novo setor; se omitido, mantém o atual' })
  @IsOptional()
  @IsInt()
  setorId?: number;

  @ApiProperty()
  @IsInt({ message: 'Escolha o novo responsável' })
  responsavelId: number;

  @ApiProperty({ example: 'Pedido negociado pelo Financeiro.' })
  @IsString()
  @MinLength(5, { message: 'Explique o motivo da redistribuição' })
  @MaxLength(4000)
  motivo: string;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @Transform(vazioParaUndefined)
  @IsDia()
  prazo?: string;
}

export const ESCOPOS = ['todas', 'minhas', 'validacao'] as const;
export type Escopo = (typeof ESCOPOS)[number];

export class FiltroDivergenciasDto extends PaginacaoDto {
  @ApiPropertyOptional({
    enum: ESCOPOS,
    default: 'todas',
    description:
      'todas = central (tratador vê só o seu setor); minhas = comigo e não concluídas; validacao = devolvidas ao Fiscal',
  })
  @IsOptional()
  @IsIn(ESCOPOS)
  escopo: Escopo = 'todas';

  @ApiPropertyOptional({ description: 'Protocolo, número da NF, chave, fornecedor ou CNPJ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ enum: StatusDivergencia })
  @IsOptional()
  @IsEnum(StatusDivergencia)
  status?: StatusDivergencia;

  @ApiPropertyOptional({ description: 'Somente com prazo vencido e ainda com o setor' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  atrasadas?: boolean;

  @ApiPropertyOptional({ enum: Prioridade })
  @IsOptional()
  @IsEnum(Prioridade)
  prioridade?: Prioridade;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  setorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsavelId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tipoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  notaFiscalId?: number;
}
