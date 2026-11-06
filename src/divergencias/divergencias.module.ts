import { Module } from '@nestjs/common';
import { DivergenciasController } from './divergencias.controller.js';
import { DivergenciasService } from './divergencias.service.js';

@Module({ controllers: [DivergenciasController], providers: [DivergenciasService] })
export class DivergenciasModule {}
