import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { FiltroMetricasDto } from './dto/metricas.dto.js';
import { MetricasService } from './metricas.service.js';

@ApiTags('Indicadores')
@ApiBearerAuth()
@Perfis('FISCAL', 'GESTOR', 'ADMIN')
@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  @Get()
  @ApiOperation({
    summary: 'Relatórios e SLA: motivos, SLA e tempo por setor, idade da fila, reincidência por fornecedor',
  })
  relatorio(@Query() filtro: FiltroMetricasDto) {
    return this.metricas.relatorio(filtro);
  }

  @Get('painel')
  @ApiOperation({ summary: 'Painel geral: fila atual, pendências que exigem atenção, volume e SLA' })
  painel() {
    return this.metricas.painel();
  }
}
