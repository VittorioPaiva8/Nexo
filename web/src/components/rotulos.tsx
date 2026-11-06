import { Badge, Group } from '@mantine/core';
import type { AcaoMovimentacao, Perfil, Prioridade, StatusDivergencia, StatusNota } from '../api/tipos';

// Vermelho só para o que é crítico (vencido, prioridade crítica); demais status em cores neutras.
export const STATUS_DIVERGENCIA: Record<StatusDivergencia, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: 'Pendente', cor: 'orange' },
  EM_TRATAMENTO: { rotulo: 'Em tratamento', cor: 'blue' },
  DEVOLVIDA: { rotulo: 'Devolvida ao Fiscal', cor: 'violet' },
  CONCLUIDA: { rotulo: 'Concluída', cor: 'green' },
};

const STATUS_NOTA: Record<StatusNota, { rotulo: string; cor: string }> = {
  SEM_PENDENCIA: { rotulo: 'Sem divergência', cor: 'gray' },
  EM_AJUSTE: { rotulo: 'Em ajuste', cor: 'orange' },
  AJUSTADA: { rotulo: 'Ajustada', cor: 'green' },
};

export const ROTULO_PERFIL: Record<Perfil, string> = {
  FISCAL: 'Fiscal',
  TRATADOR: 'Tratador',
  GESTOR: 'Gestor',
  ADMIN: 'Admin',
};

export const DESCRICAO_PERFIL: Record<Perfil, string> = {
  FISCAL: 'Cadastrar, encaminhar, validar e reabrir',
  TRATADOR: 'Responder somente o que lhe foi designado',
  GESTOR: 'Redistribuir, supervisionar e consultar relatórios',
  ADMIN: 'Configurar usuários, setores, tipos e SLA',
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const ROTULO_ACAO: Record<AcaoMovimentacao, string> = {
  CADASTRO: 'Ocorrência cadastrada e enviada ao setor',
  ASSUNCAO: 'Em tratamento',
  DEVOLUCAO: 'Devolvida ao Fiscal',
  CONCLUSAO: 'Validada e concluída',
  REABERTURA: 'Reaberta pelo Fiscal',
  REDISTRIBUICAO: 'Redistribuída',
};

export const TIPOS_SOLUCAO = [
  'Pedido de compra corrigido',
  'Cadastro regularizado',
  'NF substituída / cancelada',
  'Carta de correção emitida',
  'Requer ajuste fiscal',
  'Justificativa sem alteração',
];

export const UNIDADES = ['Cascavel', 'Guarapuava', 'Matelândia', 'Francisco Beltrão'];

const SEM_CORTE = { flexShrink: 0, maxWidth: 'none' } as const;
const ROTULO_INTEIRO = { label: { overflow: 'visible' } } as const;

export function BadgeDivergencia({ status, atrasada }: { status: StatusDivergencia; atrasada?: boolean }) {
  const s = STATUS_DIVERGENCIA[status];
  return (
    <Group gap={4}>
      <Badge color={s.cor} variant="light" radius="xl" style={SEM_CORTE} styles={ROTULO_INTEIRO}>
        {s.rotulo}
      </Badge>
      {atrasada && (
        <Badge color="itaxRed" variant="light" radius="xl" style={SEM_CORTE} styles={ROTULO_INTEIRO}>
          Atrasada
        </Badge>
      )}
    </Group>
  );
}

export function BadgePrioridade({ prioridade }: { prioridade: Prioridade }) {
  if (prioridade === 'NORMAL') return null;
  return (
    <Badge
      color={prioridade === 'CRITICA' ? 'itaxRed' : 'yellow'}
      variant="outline"
      radius="xl"
      size="sm"
      style={SEM_CORTE}
      styles={ROTULO_INTEIRO}
    >
      {ROTULO_PRIORIDADE[prioridade]}
    </Badge>
  );
}

export function BadgeNota({ status }: { status: StatusNota }) {
  const s = STATUS_NOTA[status];
  return (
    <Badge color={s.cor} variant="light" radius="xl">
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
