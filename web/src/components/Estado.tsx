import { Alert, Center, Loader, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export function Carregando() {
  return (
    <Center py="xl">
      <Loader color="itaxRed" />
    </Center>
  );
}

export function ErroCarregar({ mensagem }: { mensagem: string }) {
  return (
    <Alert color="itaxRed" icon={<IconAlertTriangle stroke={1.5} />} title="Não foi possível carregar">
      {mensagem}
    </Alert>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Stack align="center" gap={4} py="xl">
      <IconInbox size={40} stroke={1.25} color="var(--mantine-color-gray-5)" />
      <Text fw={600}>{titulo}</Text>
      {children && (
        <Text c="dimmed" fz="sm" ta="center">
          {children}
        </Text>
      )}
    </Stack>
  );
}
