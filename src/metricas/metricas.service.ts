import { Injectable } from '@nestjs/common';
import { hojeBrasilia, inicioDoDia } from '../common/datas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularMetricas, principaisOrigens, situacaoSla, volumePorDia } from './calculo.js';
import type { FiltroMetricasDto } from './dto/metricas.dto.js';

const CAMPOS = {
  id: true,
  protocolo: true,
  status: true,
  prazo: true,
  prioridade: true,
  abertaEm: true,
  devolvidaEm: true,
  concluidaEm: true,
  reaberturas: true,
  setorId: true,
  responsavelAtualId: true,
  tipo: { select: { nome: true } },
  setor: { select: { nome: true } },
  responsavelAtual: { select: { nome: true } },
  notaFiscal: { select: { numero: true, emitenteCnpj: true, emitenteNome: true } },
} satisfies Prisma.DivergenciaSelect;

type Linha = Prisma.DivergenciaGetPayload<{ select: typeof CAMPOS }>;

const PESO_PRIORIDADE = { CRITICA: 0, ALTA: 1, NORMAL: 2 } as const;

@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Relatórios e SLA, com filtro por período de abertura, setor e tipo. */
  async relatorio(filtro: FiltroMetricasDto) {
    const abertaEm: Prisma.DateTimeFilter = {};
    if (filtro.inicio) abertaEm.gte = inicioDoDia(filtro.inicio);
    if (filtro.fim) abertaEm.lt = new Date(inicioDoDia(filtro.fim).getTime() + 86_400_000);
    return this.calcular({
      ...(filtro.inicio || filtro.fim ? { abertaEm } : {}),
      tipoId: filtro.tipoId,
      setorId: filtro.setorId,
    });
  }

  /** Painel geral: fila atual, volume recente, origens e SLA. */
  async painel() {
    const agora = new Date();
    const hoje = hojeBrasilia(agora);
    const inicioMes = inicioDoDia(`${hoje.slice(0, 8)}01`);
    const trintaDias = new Date(agora.getTime() - 30 * 86_400_000);

    const divergencias = await this.prisma.divergencia.findMany({
      where: {
        OR: [
          { status: { not: 'CONCLUIDA' } },
          { abertaEm: { gte: trintaDias } },
          { concluidaEm: { gte: inicioMes } },
        ],
      },
      select: CAMPOS,
    });
    const { resumo } = await this.calcular({ id: { in: divergencias.map((d) => d.id) } }, divergencias);
    const concluidasMes = divergencias.filter((d) => d.concluidaEm && d.concluidaEm >= inicioMes);
    const noPrazoMes = concluidasMes.filter((d) => situacaoSla(this.base(d), agora) === 'cumprido').length;
    const recentes = divergencias.filter((d) => d.abertaEm >= trintaDias);

    const atencao = divergencias
      .filter((d) => d.status !== 'CONCLUIDA')
      .map((d) => ({ d, atrasada: situacaoSla(this.base(d), agora) === 'violado' && !d.concluidaEm }))
      .toSorted(
        (a, b) =>
          Number(b.atrasada) - Number(a.atrasada) ||
          PESO_PRIORIDADE[a.d.prioridade] - PESO_PRIORIDADE[b.d.prioridade] ||
          a.d.prazo.getTime() - b.d.prazo.getTime(),
      )
      .slice(0, 5)
      .map(({ d, atrasada }) => ({
        id: d.id,
        protocolo: d.protocolo,
        status: d.status,
        prioridade: d.prioridade,
        prazo: d.prazo,
        atrasada,
        numeroNf: d.notaFiscal.numero,
        fornecedor: d.notaFiscal.emitenteNome,
        tipo: d.tipo.nome,
        setor: d.setor.nome,
        responsavel: d.responsavelAtual?.nome ?? null,
      }));

    return {
      kpis: {
        abertas: resumo.abertas,
        cadastradasHoje: divergencias.filter((d) => hojeBrasilia(d.abertaEm) === hoje).length,
        emTratamento: resumo.emTratamento + resumo.pendentes,
        aguardandoValidacao: resumo.aguardandoValidacao,
        concluidasMes: concluidasMes.length,
        noPrazoMes: concluidasMes.length ? Math.round((noPrazoMes / concluidasMes.length) * 100) : null,
      },
      atencao,
      volumePorDia: volumePorDia(
        recentes.map((d) => d.abertaEm),
        agora,
      ),
      principaisOrigens: principaisOrigens(contarPorTipo(recentes)),
      sla: {
        diasMediosResolucao: resumo.diasMediosResolucao,
        vencidas: resumo.atrasadas,
        responsaveisAtribuidos: resumo.responsaveisAtribuidos,
        taxaReabertura: resumo.taxaReabertura,
      },
    };
  }

  private base(d: Linha) {
    return {
      status: d.status,
      prazo: d.prazo,
      abertaEm: d.abertaEm,
      devolvidaEm: d.devolvidaEm,
      concluidaEm: d.concluidaEm,
      reaberturas: d.reaberturas,
      tipoNome: d.tipo.nome,
      setorId: d.setorId,
      setorNome: d.setor.nome,
      fornecedorCnpj: d.notaFiscal.emitenteCnpj,
      fornecedorNome: d.notaFiscal.emitenteNome,
      temResponsavel: d.responsavelAtualId !== null,
    };
  }

  private async calcular(where: Prisma.DivergenciaWhereInput, prontas?: Linha[]) {
    const divergencias = prontas ?? (await this.prisma.divergencia.findMany({ where, select: CAMPOS }));
    const atribuicoes = await this.prisma.atribuicao.findMany({
      where: { divergenciaId: { in: divergencias.map((d) => d.id) } },
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
      divergencias.map((d) => this.base(d)),
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

function contarPorTipo(divergencias: Linha[]) {
  const m = new Map<string, number>();
  for (const d of divergencias) m.set(d.tipo.nome, (m.get(d.tipo.nome) ?? 0) + 1);
  return [...m.entries()]
    .map(([tipo, quantidade]) => ({ tipo, quantidade }))
    .toSorted((a, b) => b.quantidade - a.quantidade);
}
