import { Module } from '@nestjs/common';
import { TiposDivergenciaController } from './tipos-divergencia.controller.js';

@Module({ controllers: [TiposDivergenciaController] })
export class TiposDivergenciaModule {}
