import type { StatusDivergencia } from '../generated/prisma/enums.js';
import { horasEntre } from '../divergencias/regras.js';

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
  abertaEm: Date;
  resolvidaEm: Date | null;
  tipoNome: string;
  devolucoes: number;
}

export interface LinhaTempo {
  id: number | null;
  nome: string;
  /** Soma das horas que as notas ficaram paradas com o setor/pessoa. */
  horasTotais: number;
  /** Média de horas por passagem (atribuição). */
  horasMedias: number;
  passagens: number;
  pendentesAgora: number;
}

export const FAIXAS_IDADE = [
  { faixa: 'Até 1 dia', ate: 24 },
  { faixa: '1 a 3 dias', ate: 72 },
  { faixa: '3 a 7 dias', ate: 168 },
  { faixa: 'Mais de 7 dias', ate: Number.POSITIVE_INFINITY },
] as const;

const SEM_SETOR = 'Sem setor';

function arred(n: number): number {
  return Math.round(n * 10) / 10;
}

function media(valores: number[]): number {
  return valores.length ? arred(valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
}

function agrupar(
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

/** Calcula os indicadores do painel a partir das divergências e das passagens por responsável. */
export function calcularMetricas(
  divergencias: DivergenciaBase[],
  atribuicoes: AtribuicaoBase[],
  agora: Date,
) {
  const abertas = divergencias.filter((d) => d.status !== 'RESOLVIDA');
  const resolvidas = divergencias.filter((d) => d.status === 'RESOLVIDA');
  const idadeAbertas = abertas.map((d) => horasEntre(d.abertaEm, null, agora));

  const porTipo = new Map<string, number>();
  for (const d of divergencias) porTipo.set(d.tipoNome, (porTipo.get(d.tipoNome) ?? 0) + 1);

  return {
    resumo: {
      total: divergencias.length,
      abertas: abertas.length,
      pendentesComResponsavel: abertas.filter((d) => d.status === 'PENDENTE').length,
      aguardandoRevisao: abertas.filter((d) => d.status === 'AGUARDANDO_REVISAO').length,
      resolvidas: resolvidas.length,
      horasMediasAbertas: media(idadeAbertas),
      horasMediasResolucao: media(resolvidas.map((d) => horasEntre(d.abertaEm, d.resolvidaEm, agora))),
      taxaReabertura: divergencias.length
        ? arred((divergencias.filter((d) => d.devolucoes > 0).length / divergencias.length) * 100)
        : 0,
    },
    porSetor: agrupar(atribuicoes, (a) => ({ id: a.setorId, nome: a.setorNome ?? SEM_SETOR }), agora),
    porResponsavel: agrupar(atribuicoes, (a) => ({ id: a.responsavelId, nome: a.responsavelNome }), agora),
    faixasIdade: FAIXAS_IDADE.map((f, i) => {
      const de = i === 0 ? 0 : FAIXAS_IDADE[i - 1]!.ate;
      return { faixa: f.faixa, quantidade: idadeAbertas.filter((h) => h >= de && h < f.ate).length };
    }),
    porTipo: [...porTipo.entries()]
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .toSorted((a, b) => b.quantidade - a.quantidade),
  };
}
