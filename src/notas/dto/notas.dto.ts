import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacaoDto } from '../../common/paginacao.dto.js';
import { StatusNota } from '../../generated/prisma/enums.js';

export class FiltroNotasDto extends PaginacaoDto {
  @ApiPropertyOptional({ enum: StatusNota })
  @IsOptional()
  @IsEnum(StatusNota)
  status?: StatusNota;

  @ApiPropertyOptional({ description: 'Busca por número, chave de acesso, CNPJ ou nome do emitente' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  importacaoId?: number;
}
