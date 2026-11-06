import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { EventoNotificacao } from '../generated/prisma/enums.js';
import { ConfigurarAvisoDto } from './dto/notificacoes.dto.js';
import { NotificacoesService } from './notificacoes.service.js';

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  @ApiOperation({ summary: 'Últimos avisos do usuário logado e total não lido' })
  minhas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.notificacoes.minhas(usuario.id);
  }

  @Post('lidas')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marca os avisos do usuário como lidos' })
  marcarLidas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.notificacoes.marcarLidas(usuario.id);
  }

  @Get('configuracoes')
  @ApiOperation({ summary: 'Preferências de disparo de avisos' })
  configuracoes() {
    return this.notificacoes.configuracoes();
  }

  @Patch('configuracoes/:evento')
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Liga ou desliga um tipo de aviso' })
  configurar(
    @Param('evento', new ParseEnumPipe(EventoNotificacao)) evento: EventoNotificacao,
    @Body() dto: ConfigurarAvisoDto,
  ) {
    return this.notificacoes.configurar(evento, dto.ativo);
  }
}
