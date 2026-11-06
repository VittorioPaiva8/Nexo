import { Module } from '@nestjs/common';
import { NotasController } from './notas.controller.js';
import { NotasService } from './notas.service.js';

@Module({ controllers: [NotasController], providers: [NotasService] })
export class NotasModule {}
