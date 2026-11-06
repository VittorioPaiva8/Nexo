import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { AtualizarUsuarioDto, CriarUsuarioDto, FiltroUsuariosDto } from './dto/usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários (usado para escolher o responsável)' })
  listar(@Query() filtro: FiltroUsuariosDto) {
    return this.usuarios.listar(filtro);
  }

  @Post()
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Cria um usuário' })
  criar(@Body() dto: CriarUsuarioDto) {
    return this.usuarios.criar(dto);
  }

  @Patch(':id')
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Atualiza ou desativa um usuário' })
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarUsuarioDto) {
    return this.usuarios.atualizar(id, dto);
  }
}
