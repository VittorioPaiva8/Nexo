import type { Perfil, StatusDivergencia, StatusNota } from '../generated/prisma/enums.js';

export type AcaoDivergencia = 'assumir' | 'rascunho' | 'devolver' | 'concluir' | 'reabrir' | 'redistribuir';

export interface ContextoAcao {
  status: StatusDivergencia;
  usuarioId: number;
  perfil: Perfil;
  responsavelAtualId: number | null;
}

export class RegraViolada extends Error {
  constructor(
    message: string,
    public readonly tipo: 'estado' | 'permissao',
  ) {
    super(message);
  }
}

/** Perfis que cadastram, validam, reabrem e redistribuem (manual, seção 12). */
export const PERFIS_FISCAIS: readonly Perfil[] = ['FISCAL', 'GESTOR', 'ADMIN'];
/** Perfis que podem escolher responsável fora do setor designado. */
export const PERFIS_GESTAO: readonly Perfil[] = ['GESTOR', 'ADMIN'];

const COM_O_SETOR: StatusDivergencia[] = ['PENDENTE', 'EM_TRATAMENTO'];

const REGRAS: Record<
  AcaoDivergencia,
  {
    de: StatusDivergencia[];
    quem: 'responsavel' | 'fiscal';
    para: (s: StatusDivergencia) => StatusDivergencia;
  }
> = {
  assumir: { de: ['PENDENTE'], quem: 'responsavel', para: () => 'EM_TRATAMENTO' },
  rascunho: { de: COM_O_SETOR, quem: 'responsavel', para: (s) => s },
  devolver: { de: COM_O_SETOR, quem: 'responsavel', para: () => 'DEVOLVIDA' },
  concluir: { de: ['DEVOLVIDA'], quem: 'fiscal', para: () => 'CONCLUIDA' },
  reabrir: { de: ['DEVOLVIDA'], quem: 'fiscal', para: () => 'EM_TRATAMENTO' },
  redistribuir: { de: COM_O_SETOR, quem: 'fiscal', para: () => 'PENDENTE' },
};

const VERBO: Record<AcaoDivergencia, string> = {
  assumir: 'assumir',
  rascunho: 'salvar rascunho de',
  devolver: 'devolver ao Fiscal',
  concluir: 'concluir',
  reabrir: 'reabrir',
  redistribuir: 'redistribuir',
};

export const ROTULO_STATUS: Record<StatusDivergencia, string> = {
  PENDENTE: 'Pendente',
  EM_TRATAMENTO: 'Em tratamento',
  DEVOLVIDA: 'Devolvida ao Fiscal',
  CONCLUIDA: 'Concluída',
};

/**
 * Valida se o usuário pode executar a ação e devolve o próximo status.
 * - assumir, rascunho e devolver: só o responsável designado, enquanto está com o setor;
 * - concluir e reabrir: Fiscal, gestor ou admin, depois da devolução;
 * - redistribuir: Fiscal, gestor ou admin, enquanto está com o setor.
 */
export function proximoStatus(acao: AcaoDivergencia, ctx: ContextoAcao): StatusDivergencia {
  const regra = REGRAS[acao];
  if (!regra.de.includes(ctx.status)) {
    throw new RegraViolada(
      `Não é possível ${VERBO[acao]} uma divergência com status "${ROTULO_STATUS[ctx.status]}"`,
      'estado',
    );
  }
  const permitido =
    regra.quem === 'responsavel'
      ? ctx.responsavelAtualId === ctx.usuarioId
      : PERFIS_FISCAIS.includes(ctx.perfil);
  if (!permitido) {
    const quem = regra.quem === 'responsavel' ? 'o responsável designado' : 'o Fiscal ou o gestor';
    throw new RegraViolada(`Somente ${quem} pode ${VERBO[acao]} esta divergência`, 'permissao');
  }
  return regra.para(ctx.status);
}

/** Status da nota a partir dos status das suas divergências. */
export function statusDaNota(divergencias: StatusDivergencia[]): StatusNota {
  if (divergencias.length === 0) return 'SEM_PENDENCIA';
  return divergencias.every((s) => s === 'CONCLUIDA') ? 'AJUSTADA' : 'EM_AJUSTE';
}

/** Vencida = prazo passou enquanto a divergência ainda está com o setor. */
export function estaAtrasada(status: StatusDivergencia, fimPrazo: Date, agora: Date): boolean {
  return COM_O_SETOR.includes(status) && agora > fimPrazo;
}

/** Formata o protocolo estável: DF-AAAA-NNNN. */
export function formatarProtocolo(ano: number, sequencia: number): string {
  return `DF-${ano}-${String(sequencia).padStart(4, '0')}`;
}
