import type { Perfil, StatusDivergencia, StatusNota } from '../generated/prisma/enums.js';

export type AcaoDivergencia = 'responder' | 'repassar' | 'aceitar' | 'devolver';

export interface ContextoAcao {
  status: StatusDivergencia;
  usuarioId: number;
  perfil: Perfil;
  solicitanteId: number;
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

const ESTADO_EXIGIDO: Record<AcaoDivergencia, StatusDivergencia> = {
  responder: 'PENDENTE',
  repassar: 'PENDENTE',
  aceitar: 'AGUARDANDO_REVISAO',
  devolver: 'AGUARDANDO_REVISAO',
};

const PROXIMO_ESTADO: Record<AcaoDivergencia, StatusDivergencia> = {
  responder: 'AGUARDANDO_REVISAO',
  repassar: 'PENDENTE',
  aceitar: 'RESOLVIDA',
  devolver: 'PENDENTE',
};

const DESCRICAO_ESTADO: Record<StatusDivergencia, string> = {
  PENDENTE: 'pendente com o responsável',
  AGUARDANDO_REVISAO: 'aguardando revisão do solicitante',
  RESOLVIDA: 'resolvida',
};

/**
 * Valida se o usuário pode executar a ação na divergência e devolve o próximo status.
 * - responder: só o responsável atual, com a divergência pendente;
 * - repassar: responsável atual, solicitante ou admin, com a divergência pendente;
 * - aceitar/devolver: solicitante ou admin, depois que o responsável respondeu.
 */
export function proximoStatus(acao: AcaoDivergencia, ctx: ContextoAcao): StatusDivergencia {
  if (ctx.status !== ESTADO_EXIGIDO[acao]) {
    throw new RegraViolada(
      `Não é possível ${acao} uma divergência ${DESCRICAO_ESTADO[ctx.status]}`,
      'estado',
    );
  }
  const ehResponsavel = ctx.responsavelAtualId === ctx.usuarioId;
  const ehSolicitante = ctx.solicitanteId === ctx.usuarioId || ctx.perfil === 'ADMIN';
  const permitido =
    acao === 'responder'
      ? ehResponsavel
      : acao === 'repassar'
        ? ehResponsavel || ehSolicitante
        : ehSolicitante;
  if (!permitido) {
    const quem =
      acao === 'responder'
        ? 'o responsável atual'
        : acao === 'repassar'
          ? 'o responsável atual ou quem solicitou'
          : 'quem solicitou o ajuste';
    throw new RegraViolada(`Somente ${quem} pode ${acao} esta divergência`, 'permissao');
  }
  return PROXIMO_ESTADO[acao];
}

/** Status da nota a partir dos status das suas divergências. */
export function statusDaNota(divergencias: StatusDivergencia[]): StatusNota {
  if (divergencias.length === 0) return 'IMPORTADA';
  return divergencias.every((s) => s === 'RESOLVIDA') ? 'AJUSTADA' : 'EM_AJUSTE';
}

/** Horas corridas entre duas datas (fim em aberto conta até agora). */
export function horasEntre(inicio: Date, fim: Date | null, agora: Date): number {
  const ms = (fim ?? agora).getTime() - inicio.getTime();
  return Math.max(0, ms) / 3_600_000;
}
