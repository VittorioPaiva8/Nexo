import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { stringify } from 'yaml';
import { AppModule } from './app.module.js';
import { documentoOpenApi } from './configurar-app.js';

/** Gera docs/nexo-openapi.yml a partir dos controllers e DTOs (rodar a cada mudança de endpoint). */
const app = await NestFactory.create(AppModule, { logger: false, preview: true });
writeFileSync('docs/nexo-openapi.yml', stringify(documentoOpenApi(app)));
await app.close();
console.log('docs/nexo-openapi.yml atualizado');
