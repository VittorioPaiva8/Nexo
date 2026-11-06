import { describe, expect, it } from 'vitest';
import { calcularMetricas, type AtribuicaoBase, type DivergenciaBase } from './calculo.js';

const agora = new Date('2026-11-06T12:00:00Z');
const h = (horasAtras: number) => new Date(agora.getTime() - horasAtras * 3_600_000);

const compras = { setorId: 1, setorNome: 'Compras' };
const fiscal = { setorId: 2, setorNome: 'Fiscal' };

const atribuicoes: AtribuicaoBase[] = [
  // Compras: 10h + 30h (ainda aberta) = 40h em 2 passagens
  { ...compras, responsavelId: 10, responsavelNome: 'Ana', inicio: h(50), fim: h(40) },
  { ...compras, responsavelId: 11, responsavelNome: 'Bruno', inicio: h(30), fim: null },
  // Fiscal: 4h em 1 passagem
  { ...fiscal, responsavelId: 12, responsavelNome: 'Carla', inicio: h(8), fim: h(4) },
];

const divergencias: DivergenciaBase[] = [
  { status: 'PENDENTE', abertaEm: h(50), resolvidaEm: null, tipoNome: 'Valor', devolucoes: 1 },
  { status: 'AGUARDANDO_REVISAO', abertaEm: h(10), resolvidaEm: null, tipoNome: 'CFOP', devolucoes: 0 },
  { status: 'RESOLVIDA', abertaEm: h(200), resolvidaEm: h(176), tipoNome: 'Valor', devolucoes: 0 },
  { status: 'RESOLVIDA', abertaEm: h(8), resolvidaEm: h(2), tipoNome: 'Valor', devolucoes: 0 },
];

describe('calcularMetricas', () => {
  const m = calcularMetricas(divergencias, atribuicoes, agora);

  it('resume abertas, resolvidas e tempos médios', () => {
    expect(m.resumo).toEqual({
      total: 4,
      abertas: 2,
      pendentesComResponsavel: 1,
      aguardandoRevisao: 1,
      resolvidas: 2,
      horasMediasAbertas: 30, // (50 + 10) / 2
      horasMediasResolucao: 15, // (24 + 6) / 2
      taxaReabertura: 25,
    });
  });

  it('ordena os setores pelo tempo total parado', () => {
    expect(m.porSetor).toEqual([
      { id: 1, nome: 'Compras', horasTotais: 40, horasMedias: 20, passagens: 2, pendentesAgora: 1 },
      { id: 2, nome: 'Fiscal', horasTotais: 4, horasMedias: 4, passagens: 1, pendentesAgora: 0 },
    ]);
  });

  it('agrupa por responsável', () => {
    expect(m.porResponsavel.map((r) => [r.nome, r.horasTotais])).toEqual([
      ['Bruno', 30],
      ['Ana', 10],
      ['Carla', 4],
    ]);
  });

  it('distribui as abertas por faixa de idade', () => {
    expect(m.faixasIdade).toEqual([
      { faixa: 'Até 1 dia', quantidade: 1 },
      { faixa: '1 a 3 dias', quantidade: 1 },
      { faixa: '3 a 7 dias', quantidade: 0 },
      { faixa: 'Mais de 7 dias', quantidade: 0 },
    ]);
  });

  it('conta os tipos mais frequentes', () => {
    expect(m.porTipo).toEqual([
      { tipo: 'Valor', quantidade: 3 },
      { tipo: 'CFOP', quantidade: 1 },
    ]);
  });

  it('sem dados devolve zeros', () => {
    const vazio = calcularMetricas([], [], agora);
    expect(vazio.resumo.horasMediasAbertas).toBe(0);
    expect(vazio.resumo.taxaReabertura).toBe(0);
    expect(vazio.porSetor).toEqual([]);
  });
});
