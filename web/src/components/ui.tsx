import { Box, Card, Group, Paper, Progress, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/** Cabeçalho de página: sobretítulo em vermelho, título, descrição e ações (layout do protótipo). */
export function Cabecalho({
  sobretitulo,
  titulo,
  descricao,
  acoes,
}: {
  sobretitulo: string;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" gap="md">
      <Stack gap={4}>
        <Text fz={11} fw={800} c="itaxRed" tt="uppercase" style={{ letterSpacing: 1.8 }}>
          {sobretitulo}
        </Text>
        <Title order={1} fz={{ base: 22, sm: 28 }} fw={800} style={{ letterSpacing: -0.6 }}>
          {titulo}
        </Title>
        {descricao && (
          <Text c="dimmed" fz="sm">
            {descricao}
          </Text>
        )}
      </Stack>
      {acoes && <Group gap="xs">{acoes}</Group>}
    </Group>
  );
}

export function Kpi({
  rotulo,
  valor,
  rodape,
  icone,
  cor = 'itaxRed',
  destaque,
}: {
  rotulo: string;
  valor: ReactNode;
  rodape?: string;
  icone?: ReactNode;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <Paper withBorder p="lg" radius="md" pos="relative" mih={118}>
      <Text fz="sm" c="dimmed" fw={600} pr={icone ? 48 : 0}>
        {rotulo}
      </Text>
      {icone && (
        <ThemeIcon variant="light" color={cor} size={40} radius="md" pos="absolute" top={16} right={16}>
          {icone}
        </ThemeIcon>
      )}
      <Text
        fz={32}
        fw={800}
        mt={8}
        lh={1.1}
        c={destaque ? 'itaxRed' : undefined}
        style={{ letterSpacing: -1.3 }}
      >
        {valor}
      </Text>
      {rodape && (
        <Text fz="xs" c="dimmed" mt={4}>
          {rodape}
        </Text>
      )}
    </Paper>
  );
}

/** Painel com cabeçalho e corpo (cards do protótipo). */
export function Painel({
  titulo,
  extra,
  children,
  semPadding,
}: {
  titulo: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  semPadding?: boolean;
}) {
  return (
    <Card withBorder radius="md" p={0}>
      <Group
        justify="space-between"
        px="lg"
        py="md"
        gap="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Text fw={800} fz="md">
          {titulo}
        </Text>
        {extra}
      </Group>
      <Box p={semPadding ? 0 : 'lg'}>{children}</Box>
    </Card>
  );
}

export function BarraHorizontal({
  rotulo,
  valor,
  percentual,
  cor = 'itaxRed',
}: {
  rotulo: string;
  valor: ReactNode;
  percentual: number;
  cor?: string;
}) {
  return (
    <Stack gap={6} mb="md">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text fz="sm" fw={600} truncate>
          {rotulo}
        </Text>
        <Text fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
          {valor}
        </Text>
      </Group>
      <Progress value={Math.max(0, Math.min(100, percentual))} color={cor} size="md" radius="xl" />
    </Stack>
  );
}

/** Pequeno quadro de número com legenda (SLA, resumo do lote). */
export function Estatistica({ valor, legenda, cor }: { valor: ReactNode; legenda: string; cor?: string }) {
  return (
    <Paper bg="gray.0" p="md" radius="md">
      <Text component="div" fz={22} fw={800} c={cor} lh={1.2}>
        {valor}
      </Text>
      <Text fz="xs" c="dimmed">
        {legenda}
      </Text>
    </Paper>
  );
}

/** Item rótulo/valor nos detalhes da tratativa. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Paper bg="gray.0" p="sm" radius="md">
      <Text fz={11} c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.4 }}>
        {rotulo}
      </Text>
      <Text component="div" fz="sm" fw={600} mt={2}>
        {children}
      </Text>
    </Paper>
  );
}

export function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <Text fz={11} fw={800} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: 1.2 }}>
      {children}
    </Text>
  );
}

export function Destaque({ children, cor = 'gray' }: { children: ReactNode; cor?: string }) {
  return (
    <Paper bg={`${cor}.0`} p="md" radius="md" style={{ border: `1px solid var(--mantine-color-${cor}-2)` }}>
      <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {children}
      </Text>
    </Paper>
  );
}
