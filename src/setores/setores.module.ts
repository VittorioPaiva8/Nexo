import { Module } from '@nestjs/common';
import { SetoresController } from './setores.controller.js';

@Module({ controllers: [SetoresController] })
export class SetoresModule {}
