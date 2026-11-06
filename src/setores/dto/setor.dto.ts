import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CriarSetorDto {
  @ApiProperty({ example: 'Suprimentos' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome: string;

  @ApiPropertyOptional({ example: 'Pedidos e fornecedores' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  descricao?: string;

  @ApiPropertyOptional({ example: 2, description: 'Prazo padrão em dias corridos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  slaDias?: number;
}

export class AtualizarSetorDto {
  @ApiPropertyOptional({ example: 'Suprimentos' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  descricao?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  slaDias?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
