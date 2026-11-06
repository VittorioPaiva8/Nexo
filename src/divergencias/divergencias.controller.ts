import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { DivergenciasService } from './divergencias.service.js';
import {
  AceitarDivergenciaDto,
  CriarDivergenciasDto,
  DevolverDivergenciaDto,
  FiltroDivergenciasDto,
  RepassarDivergenciaDto,
  ResponderDivergenciaDto,
} from './dto/divergencias.dto.js';

@ApiTags('Divergências')
@ApiBearerAuth()
@Controller('divergencias')
export class DivergenciasController {
  constructor(private readonly divergencias: DivergenciasService) {}

  @Post()
  @Perfis('ADMIN', 'REVISOR')
  @ApiOperation({ summary: 'Marca notas como divergentes e encaminha ao responsável' })
  criar(@Body() dto: CriarDivergenciasDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.criar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista divergências (minhas pendências, solicitadas por mim ou todas)' })
  listar(@Query() filtro: FiltroDivergenciasDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.listar(filtro, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe com histórico de mensagens e tempo por responsável' })
  detalhar(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.detalhar(id, usuario);
  }

  @Post(':id/responder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Responsável envia justificativa ou correção e devolve ao solicitante' })
  responder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderDivergenciaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.responder(id, dto, usuario);
  }

  @Post(':id/repassar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Repassa a divergência para outro responsável' })
  repassar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RepassarDivergenciaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.repassar(id, dto, usuario);
  }

  @Post(':id/aceitar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicitante aceita o retorno e encerra a divergência' })
  aceitar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AceitarDivergenciaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.aceitar(id, dto, usuario);
  }

  @Post(':id/devolver')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicitante devolve ao responsável (ou a outro) pedindo novo ajuste' })
  devolver(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DevolverDivergenciaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.devolver(id, dto, usuario);
  }
}
