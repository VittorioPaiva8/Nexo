import { Module } from '@nestjs/common';
import { DivergenciasModule } from '../divergencias/divergencias.module.js';
import { ImportacoesController } from './importacoes.controller.js';
import { ImportacoesService } from './importacoes.service.js';

@Module({
  imports: [DivergenciasModule],
  controllers: [ImportacoesController],
  providers: [ImportacoesService],
})
export class ImportacoesModule {}
