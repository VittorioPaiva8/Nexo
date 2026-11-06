import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp, documentoOpenApi } from './configurar-app.js';

async function iniciar() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173').split(',') });
  configurarApp(app);
  servirSite(app, config.get<string>('SITE_DIR'));
  SwaggerModule.setup('docs', app, documentoOpenApi(app));
  const porta = config.get<number>('PORT', 3000);
  await app.listen(porta);
  Logger.log(`API do Nexo em http://localhost:${porta} — Swagger em /docs`, 'Nexo');
}

/**
 * Com SITE_DIR definido (publicação de teste num serviço só), a API responde em /api e o
 * frontend gerado (web/dist) é servido no mesmo endereço, com fallback de SPA para o index.html.
 */
function servirSite(app: NestExpressApplication, siteDir?: string) {
  if (!siteDir) return;
  const pasta = resolve(siteDir);
  const index = join(pasta, 'index.html');
  if (!existsSync(index)) throw new Error(`SITE_DIR sem index.html: ${pasta}`);
  app.setGlobalPrefix('api');
  app.useStaticAssets(pasta, { index: false });
  app
    .getHttpAdapter()
    .getInstance()
    .get(/^\/(?!api(\/|$)|docs(\/|$)).*/, (_req: unknown, res: { sendFile: (p: string) => void }) =>
      res.sendFile(index),
    );
}

void iniciar();
