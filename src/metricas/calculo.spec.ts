import { describe, expect, it } from 'vitest';
import { dataDoDia } from '../common/datas.js';
import {
  calcularMetricas,
  principaisOrigens,
  situacaoSla,
  volumePorDia,
  type AtribuicaoBase,
  type DivergenciaBase,
} from './calculo.js';

// Sexta-feira, 06/11/2026, 09h em Brasília.
const agora = new Date('2026-11-06T12:00:00Z');
const h = (horasAtras: number) => new Date(agora.getTime() - horasAtras * 3_600_000);

const sup = { setorId: 1, setorNome: 'Suprimentos' };
const fin = { setorId: 2, setorNome: 'Financeiro' };

const atribuicoes: AtribuicaoBase[] = [
  // Suprimentos: 10h + 30h (ainda aberta) = 40h em 2 passagens
  { ...sup, responsavelId: 10, responsavelNome: 'Ana', inicio: h(50), fim: h(40) },
  { ...sup, responsavelId: 11, responsavelNome: 'Bruno', inicio: h(30), fim: null },
  // Financeiro: 4h em 1 passagem
  { ...fin, responsavelId: 12, responsavelNome: 'Carla', inicio: h(8), fim: h(4) },
];

function d(p: Partial<DivergenciaBase>): DivergenciaBase {
  return {
    status: 'PENDENTE',
    prazo: dataDoDia('2026-11-10'),
    abertaEm: h(10),
    devolvidaEm: null,
    concluidaEm: null,
    reaberturas: 0,
    tipoNome: 'Sem pedido de compra',
    ...sup,
    fornecedorCnpj: '11222333000181',
    fornecedorNome: 'Alfa',
    temResponsavel: true,
    ...p,
  };
}

const divergencias: DivergenciaBase[] = [
  // vencida com o setor
  d({
    status: 'EM_TRATAMENTO',
    abertaEm: h(50),
    prazo: dataDoDia('2026-11-05'),
    reaberturas: 1,
    devolvidaEm: h(45),
  }),
  // aguardando o Fiscal, prazo vencido não conta contra o setor
  d({
    status: 'DEVOLVIDA',
    abertaEm: h(10),
    prazo: dataDoDia('2026-11-05'),
    devolvidaEm: h(4),
    tipoNome: 'CFOP',
    ...fin,
  }),
  // concluída no prazo (o dia todo do prazo vale)
  d({
    status: 'CONCLUIDA',
    abertaEm: h(96),
    devolvidaEm: h(80),
    concluidaEm: h(72),
    prazo: dataDoDia('2026-11-03'),
  }),
  // concluída depois do prazo
  d({
    status: 'CONCLUIDA',
    abertaEm: h(48),
    devolvidaEm: h(30),
    concluidaEm: h(24),
    prazo: dataDoDia('2026-11-04'),
    fornecedorCnpj: '44555666000108',
    fornecedorNome: 'Beta',
  }),
];

describe('situacaoSla', () => {
  it('cumprido, violado ou ainda em aberto', () => {
    expect(divergencias.map((x) => situacaoSla(x, agora))).toEqual(['violado', null, 'cumprido', 'violado']);
  });
});

describe('calcularMetricas', () => {
  const m = calcularMetricas(divergencias, atribuicoes, agora);

  it('resume a fila, o SLA e os tempos em dias', () => {
    expect(m.resumo).toEqual({
      total: 4,
      abertas: 2,
      pendentes: 0,
      emTratamento: 1,
      aguardandoValidacao: 1,
      concluidas: 2,
      atrasadas: 1,
      taxaSla: 33, // 1 cumprida de 3 avaliadas
      diasMediosResolucao: 1, // (1 + 1) / 2
      diasMediosAbertas: 1.3, // (50h + 10h) / 2 / 24
      taxaReabertura: 25, // 1 reaberta de 4 analisadas pelo Fiscal
      responsaveisAtribuidos: 100,
    });
  });

  it('SLA e tempo por setor', () => {
    expect(m.porSetor).toEqual([
      {
        id: 1,
        nome: 'Suprimentos',
        total: 3,
        abertas: 1,
        atrasadas: 1,
        taxaSla: 33,
        horasTotais: 40,
        horasMedias: 20,
        passagens: 2,
      },
      {
        id: 2,
        nome: 'Financeiro',
        total: 1,
        abertas: 1,
        atrasadas: 0,
        taxaSla: null,
        horasTotais: 4,
        horasMedias: 4,
        passagens: 1,
      },
    ]);
  });

  it('agrupa por responsável, idade da fila, motivo e fornecedor', () => {
    expect(m.porResponsavel.map((r) => [r.nome, r.horasTotais])).toEqual([
      ['Bruno', 30],
      ['Ana', 10],
      ['Carla', 4],
    ]);
    expect(m.faixasIdade).toEqual([
      { faixa: '0–1 dia', quantidade: 1 },
      { faixa: '2–3 dias', quantidade: 1 },
      { faixa: '4–7 dias', quantidade: 0 },
      { faixa: 'Acima de 7 dias', quantidade: 0 },
    ]);
    expect(m.porTipo).toEqual([
      { tipo: 'Sem pedido de compra', quantidade: 3 },
      { tipo: 'CFOP', quantidade: 1 },
    ]);
    expect(m.porFornecedor[0]).toEqual({
      cnpj: '11222333000181',
      nome: 'Alfa',
      quantidade: 3,
      principalMotivo: 'Sem pedido de compra',
    });
  });

  it('sem dados não divide por zero', () => {
    const vazio = calcularMetricas([], [], agora);
    expect(vazio.resumo.taxaSla).toBeNull();
    expect(vazio.resumo.diasMediosResolucao).toBe(0);
  });
});

describe('painel', () => {
  it('volume dos últimos dias úteis', () => {
    const v = volumePorDia([h(1), h(2), h(24 * 3)], agora, 5);
    expect(v).toEqual([
      { dia: '2026-11-02', quantidade: 0 },
      { dia: '2026-11-03', quantidade: 1 },
      { dia: '2026-11-04', quantidade: 0 },
      { dia: '2026-11-05', quantidade: 0 },
      { dia: '2026-11-06', quantidade: 2 },
    ]);
  });

  it('agrupa as origens além das três primeiras', () => {
    expect(
      principaisOrigens([
        { tipo: 'A', quantidade: 5 },
        { tipo: 'B', quantidade: 3 },
        { tipo: 'C', quantidade: 1 },
        { tipo: 'D', quantidade: 1 },
      ]),
    ).toEqual([
      { tipo: 'A', quantidade: 5, percentual: 50 },
      { tipo: 'B', quantidade: 3, percentual: 30 },
      { tipo: 'C', quantidade: 1, percentual: 10 },
      { tipo: 'Outras divergências', quantidade: 1, percentual: 10 },
    ]);
  });
});
