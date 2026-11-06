import { Group, Text } from '@mantine/core';

/**
 * Nome do sistema no cabeçalho. O logotipo oficial do Grupo Itax (grupo-itax-logo-branca.svg)
 * deve ser colocado em web/public/ e entra à esquerda; não recriamos nem recolorimos o logo (manual 2.2).
 */
export function Marca({ tamanho = 'lg' }: { tamanho?: 'lg' | 'xl' }) {
  return (
    <Group gap={10} wrap="nowrap">
      <img
        src="/grupo-itax-logo-branca.svg"
        alt="Grupo Itax"
        style={{ height: tamanho === 'xl' ? 40 : 24, minWidth: 0 }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <Text c="white" fw={600} fz={tamanho} style={{ letterSpacing: -0.5 }}>
        Fluxo Fiscal
      </Text>
    </Group>
  );
}
