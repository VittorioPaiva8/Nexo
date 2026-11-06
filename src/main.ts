import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp, documentoOpenApi } from './configurar-app.js';

async function iniciar() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173').split(',') });
  configurarApp(app);
  SwaggerModule.setup('docs', app, documentoOpenApi(app));
  const porta = config.get<number>('PORT', 3000);
  await app.listen(porta);
  Logger.log(`API do Nexo em http://localhost:${porta} — Swagger em /docs`, 'Nexo');
}

void iniciar();
