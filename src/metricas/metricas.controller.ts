import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { FiltroMetricasDto } from './dto/metricas.dto.js';
import { MetricasService } from './metricas.service.js';

@ApiTags('Métricas')
@ApiBearerAuth()
@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  @Get()
  @Perfis('ADMIN', 'REVISOR')
  @ApiOperation({
    summary: 'Indicadores do painel: setores que mais seguram notas, tempos médios, faixas de idade',
  })
  calcular(@Query() filtro: FiltroMetricasDto) {
    return this.metricas.calcular(filtro);
  }
}
