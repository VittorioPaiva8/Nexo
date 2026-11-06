import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Perfil } from '../../generated/prisma/enums.js';

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiProperty({ example: 'maria@empresa.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha tem no mínimo 6 caracteres' })
  senha: string;

  @ApiProperty({ enum: Perfil })
  @IsEnum(Perfil)
  perfil: Perfil;

  @ApiPropertyOptional({ description: 'Setor principal do usuário (obrigatório para tratadores)' })
  @IsOptional()
  @IsInt()
  setorId?: number;
}

export class AtualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha tem no mínimo 6 caracteres' })
  senha?: string;

  @ApiPropertyOptional({ enum: Perfil })
  @IsOptional()
  @IsEnum(Perfil)
  perfil?: Perfil;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  setorId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class FiltroUsuariosDto {
  @ApiPropertyOptional({ enum: Perfil })
  @IsOptional()
  @IsEnum(Perfil)
  perfil?: Perfil;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  setorId?: number;

  @ApiPropertyOptional({ description: 'Nome ou e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ description: 'Inclui usuários inativos' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirInativos?: boolean;
}
