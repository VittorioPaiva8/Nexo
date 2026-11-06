import { Badge } from '@mantine/core';
import type { Perfil, StatusDivergencia, StatusNota, TipoMensagem } from '../api/tipos';

// Vermelho só para o que é crítico/pendente; verde e amarelo para sucesso e atenção (manual, seção 6).
const STATUS_DIVERGENCIA: Record<StatusDivergencia, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: 'Pendente', cor: 'itaxRed' },
  AGUARDANDO_REVISAO: { rotulo: 'Aguardando revisão', cor: 'yellow' },
  RESOLVIDA: { rotulo: 'Resolvida', cor: 'green' },
};

const STATUS_NOTA: Record<StatusNota, { rotulo: string; cor: string }> = {
  IMPORTADA: { rotulo: 'Sem pendência', cor: 'gray' },
  EM_AJUSTE: { rotulo: 'Em ajuste', cor: 'itaxRed' },
  AJUSTADA: { rotulo: 'Ajustada', cor: 'green' },
};

export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  REVISOR: 'Revisor',
  RESPONSAVEL: 'Responsável',
};

export const ROTULO_MENSAGEM: Record<TipoMensagem, string> = {
  SOLICITACAO: 'Solicitou ajuste',
  JUSTIFICATIVA: 'Justificou',
  CORRECAO: 'Corrigiu',
  REPASSE: 'Repassou',
  DEVOLUCAO: 'Devolveu',
  ACEITE: 'Aceitou',
};

export function BadgeDivergencia({ status }: { status: StatusDivergencia }) {
  const s = STATUS_DIVERGENCIA[status];
  return (
    <Badge color={s.cor} variant="light">
      {s.rotulo}
    </Badge>
  );
}

export function BadgeNota({ status }: { status: StatusNota }) {
  const s = STATUS_NOTA[status];
  return (
    <Badge color={s.cor} variant="light">
      {s.rotulo}
    </Badge>
  );
}

/** Tempo parado com destaque: até 1 dia neutro, até 3 dias atenção, acima disso crítico. */
export function corDoTempo(horas: number | null): string {
  if (horas === null) return 'gray';
  if (horas < 24) return 'gray';
  if (horas < 72) return 'yellow';
  return 'itaxRed';
}
