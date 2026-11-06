import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { PerfisGuard } from './common/perfis.guard.js';
import { DivergenciasModule } from './divergencias/divergencias.module.js';
import { ImportacoesModule } from './importacoes/importacoes.module.js';
import { MetricasModule } from './metricas/metricas.module.js';
import { NotasModule } from './notas/notas.module.js';
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SetoresModule } from './setores/setores.module.js';
import { TiposDivergenciaModule } from './tipos-divergencia/tipos-divergencia.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    SetoresModule,
    TiposDivergenciaModule,
    NotasModule,
    NotificacoesModule,
    DivergenciasModule,
    ImportacoesModule,
    MetricasModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PerfisGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
