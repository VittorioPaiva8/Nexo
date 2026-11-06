import { fimDoPrazo, hojeBrasilia, horasEntre } from '../common/datas.js';
import type { StatusDivergencia } from '../generated/prisma/enums.js';

export interface AtribuicaoBase {
  setorId: number | null;
  setorNome: string | null;
  responsavelId: number;
  responsavelNome: string;
  inicio: Date;
  fim: Date | null;
}

export interface DivergenciaBase {
  status: StatusDivergencia;
  prazo: Date;
  abertaEm: Date;
  devolvidaEm: Date | null;
  concluidaEm: Date | null;
  reaberturas: number;
  tipoNome: string;
  setorId: number;
  setorNome: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  temResponsavel: boolean;
}

export interface LinhaTempo {
  id: number | null;
  nome: string;
  /** Soma das horas que as notas ficaram com o setor/pessoa. */
  horasTotais: number;
  /** Média de horas por passagem (atribuição). */
  horasMedias: number;
  passagens: number;
  pendentesAgora: number;
}

/** Fila por idade de pendência (manual, seção 10). */
export const FAIXAS_IDADE = [
  { faixa: '0–1 dia', ateDias: 2 },
  { faixa: '2–3 dias', ateDias: 4 },
  { faixa: '4–7 dias', ateDias: 8 },
  { faixa: 'Acima de 7 dias', ateDias: Number.POSITIVE_INFINITY },
] as const;

const SEM_SETOR = 'Sem setor';
const COM_O_SETOR: StatusDivergencia[] = ['PENDENTE', 'EM_TRATAMENTO'];

function arred(n: number): number {
  return Math.round(n * 10) / 10;
}

function media(valores: number[]): number {
  return valores.length ? arred(valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
}

function pct(parte: number, todo: number): number | null {
  return todo ? Math.round((parte / todo) * 100) : null;
}

/**
 * Situação de SLA: cumprido = concluída até o fim do dia do prazo; violado = concluída depois
 * ou ainda com o setor e vencida. Abertas dentro do prazo (ou aguardando o Fiscal) ainda não contam.
 */
export function situacaoSla(d: DivergenciaBase, agora: Date): 'cumprido' | 'violado' | null {
  const limite = fimDoPrazo(d.prazo);
  if (d.concluidaEm) return d.concluidaEm <= limite ? 'cumprido' : 'violado';
  if (COM_O_SETOR.includes(d.status) && agora > limite) return 'violado';
  return null;
}

function taxaSla(divergencias: DivergenciaBase[], agora: Date): number | null {
  const s = divergencias.map((d) => situacaoSla(d, agora)).filter((x) => x !== null);
  return pct(s.filter((x) => x === 'cumprido').length, s.length);
}

function agruparTempo(
  atribuicoes: AtribuicaoBase[],
  chave: (a: AtribuicaoBase) => { id: number | null; nome: string },
  agora: Date,
): LinhaTempo[] {
  const grupos = new Map<string, LinhaTempo & { soma: number }>();
  for (const a of atribuicoes) {
    const { id, nome } = chave(a);
    const k = String(id);
    const g = grupos.get(k) ?? {
      id,
      nome,
      horasTotais: 0,
      horasMedias: 0,
      passagens: 0,
      pendentesAgora: 0,
      soma: 0,
    };
    g.soma += horasEntre(a.inicio, a.fim, agora);
    g.passagens += 1;
    if (!a.fim) g.pendentesAgora += 1;
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .map(({ soma, ...g }) => ({ ...g, horasTotais: arred(soma), horasMedias: arred(soma / g.passagens) }))
    .toSorted((a, b) => b.horasTotais - a.horasTotais || b.pendentesAgora - a.pendentesAgora);
}

function contar<T>(itens: T[], chave: (i: T) => string) {
  const m = new Map<string, T[]>();
  for (const i of itens) m.set(chave(i), [...(m.get(chave(i)) ?? []), i]);
  return m;
}

/** Indicadores de gestão calculados sobre os registros persistidos (nunca valores fictícios). */
export function calcularMetricas(
  divergencias: DivergenciaBase[],
  atribuicoes: AtribuicaoBase[],
  agora: Date,
) {
  const abertas = divergencias.filter((d) => d.status !== 'CONCLUIDA');
  const concluidas = divergencias.filter((d) => d.status === 'CONCLUIDA');
  const atrasadas = abertas.filter((d) => situacaoSla(d, agora) === 'violado');
  const idadeAbertasDias = abertas.map((d) => horasEntre(d.abertaEm, null, agora) / 24);
  const analisadas = divergencias.filter((d) => d.devolvidaEm || d.reaberturas > 0);

  const tempoPorSetor = agruparTempo(
    atribuicoes,
    (a) => ({ id: a.setorId, nome: a.setorNome ?? SEM_SETOR }),
    agora,
  );
  const porSetor = [...contar(divergencias, (d) => String(d.setorId)).values()]
    .map((lista) => {
      const tempo = tempoPorSetor.find((t) => t.id === lista[0]!.setorId);
      return {
        id: lista[0]!.setorId,
        nome: lista[0]!.setorNome,
        total: lista.length,
        abertas: lista.filter((d) => d.status !== 'CONCLUIDA').length,
        atrasadas: lista.filter((d) => situacaoSla(d, agora) === 'violado' && !d.concluidaEm).length,
        taxaSla: taxaSla(lista, agora),
        horasTotais: tempo?.horasTotais ?? 0,
        horasMedias: tempo?.horasMedias ?? 0,
        passagens: tempo?.passagens ?? 0,
      };
    })
    .toSorted((a, b) => b.horasTotais - a.horasTotais || b.total - a.total);

  const porFornecedor = [...contar(divergencias, (d) => d.fornecedorCnpj).values()]
    .map((lista) => {
      const motivos = [...contar(lista, (d) => d.tipoNome).entries()].toSorted(
        (a, b) => b[1].length - a[1].length,
      );
      return {
        cnpj: lista[0]!.fornecedorCnpj,
        nome: lista[0]!.fornecedorNome,
        quantidade: lista.length,
        principalMotivo: motivos[0]![0],
      };
    })
    .toSorted((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  return {
    resumo: {
      total: divergencias.length,
      abertas: abertas.length,
      pendentes: abertas.filter((d) => d.status === 'PENDENTE').length,
      emTratamento: abertas.filter((d) => d.status === 'EM_TRATAMENTO').length,
      aguardandoValidacao: abertas.filter((d) => d.status === 'DEVOLVIDA').length,
      concluidas: concluidas.length,
      atrasadas: atrasadas.length,
      taxaSla: taxaSla(divergencias, agora),
      diasMediosResolucao: media(concluidas.map((d) => horasEntre(d.abertaEm, d.concluidaEm, agora) / 24)),
      diasMediosAbertas: media(idadeAbertasDias),
      taxaReabertura: pct(analisadas.filter((d) => d.reaberturas > 0).length, analisadas.length),
      responsaveisAtribuidos: pct(abertas.filter((d) => d.temResponsavel).length, abertas.length),
    },
    porSetor,
    tempoPorSetor,
    porResponsavel: agruparTempo(
      atribuicoes,
      (a) => ({ id: a.responsavelId, nome: a.responsavelNome }),
      agora,
    ),
    faixasIdade: FAIXAS_IDADE.map((f, i) => {
      const de = i === 0 ? 0 : FAIXAS_IDADE[i - 1]!.ateDias;
      return { faixa: f.faixa, quantidade: idadeAbertasDias.filter((h) => h >= de && h < f.ateDias).length };
    }),
    porTipo: [...contar(divergencias, (d) => d.tipoNome).entries()]
      .map(([tipo, lista]) => ({ tipo, quantidade: lista.length }))
      .toSorted((a, b) => b.quantidade - a.quantidade),
    porFornecedor,
  };
}

/** Últimos N dias úteis (seg–sex), em Brasília, com a quantidade de divergências cadastradas. */
export function volumePorDia(aberturas: Date[], agora: Date, dias = 12) {
  const resultado: { dia: string; quantidade: number }[] = [];
  let cursor = new Date(`${hojeBrasilia(agora)}T12:00:00Z`);
  while (resultado.length < dias) {
    const semana = cursor.getUTCDay();
    if (semana !== 0 && semana !== 6)
      resultado.unshift({ dia: cursor.toISOString().slice(0, 10), quantidade: 0 });
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  for (const a of aberturas) {
    const linha = resultado.find((r) => r.dia === hojeBrasilia(a));
    if (linha) linha.quantidade += 1;
  }
  return resultado;
}

/** Principais origens: os três motivos mais frequentes e o restante agrupado. */
export function principaisOrigens(porTipo: { tipo: string; quantidade: number }[]) {
  const total = porTipo.reduce((s, t) => s + t.quantidade, 0);
  if (!total) return [];
  const top = porTipo
    .slice(0, 3)
    .map((t) => ({ ...t, percentual: Math.round((t.quantidade / total) * 100) }));
  const resto = porTipo.slice(3).reduce((s, t) => s + t.quantidade, 0);
  return resto
    ? [
        ...top,
        { tipo: 'Outras divergências', quantidade: resto, percentual: Math.round((resto / total) * 100) },
      ]
    : top;
}
