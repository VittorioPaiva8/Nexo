import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function Titulo({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" gap="sm">
      <Stack gap={2}>
        <Title order={2}>{titulo}</Title>
        {descricao && (
          <Text c="dimmed" fz="sm">
            {descricao}
          </Text>
        )}
      </Stack>
      {acoes}
    </Group>
  );
}
