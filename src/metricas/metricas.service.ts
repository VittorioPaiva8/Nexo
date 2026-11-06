import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularMetricas } from './calculo.js';
import type { FiltroMetricasDto } from './dto/metricas.dto.js';

/** Datas do filtro são dias no fuso de Brasília. */
function inicioDoDia(data: string): Date {
  return new Date(`${data.slice(0, 10)}T00:00:00-03:00`);
}

@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(filtro: FiltroMetricasDto) {
    const abertaEm: Prisma.DateTimeFilter = {};
    if (filtro.inicio) abertaEm.gte = inicioDoDia(filtro.inicio);
    if (filtro.fim) abertaEm.lt = new Date(inicioDoDia(filtro.fim).getTime() + 86_400_000);

    const where: Prisma.DivergenciaWhereInput = {
      ...(filtro.inicio || filtro.fim ? { abertaEm } : {}),
      tipoId: filtro.tipoId,
      ...(filtro.setorId ? { atribuicoes: { some: { setorId: filtro.setorId } } } : {}),
    };

    const divergencias = await this.prisma.divergencia.findMany({
      where,
      select: {
        id: true,
        status: true,
        abertaEm: true,
        resolvidaEm: true,
        tipo: { select: { nome: true } },
        _count: { select: { mensagens: { where: { tipo: 'DEVOLUCAO' } } } },
      },
    });
    const atribuicoes = await this.prisma.atribuicao.findMany({
      where: {
        divergenciaId: { in: divergencias.map((d) => d.id) },
        ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
      },
      select: {
        setorId: true,
        inicio: true,
        fim: true,
        responsavelId: true,
        setor: { select: { nome: true } },
        responsavel: { select: { nome: true } },
      },
    });

    return calcularMetricas(
      divergencias.map((d) => ({
        status: d.status,
        abertaEm: d.abertaEm,
        resolvidaEm: d.resolvidaEm,
        tipoNome: d.tipo.nome,
        devolucoes: d._count.mensagens,
      })),
      atribuicoes.map((a) => ({
        setorId: a.setorId,
        setorNome: a.setor?.nome ?? null,
        responsavelId: a.responsavelId,
        responsavelNome: a.responsavel.nome,
        inicio: a.inicio,
        fim: a.fim,
      })),
      new Date(),
    );
  }
}
