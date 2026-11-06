import {
  AppShell,
  Avatar,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChartBar,
  IconChevronDown,
  IconFileImport,
  IconFileInvoice,
  IconInbox,
  IconListCheck,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import { NavLink as RouterLink, Outlet, useLocation } from 'react-router';
import type { Perfil } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { CORES_ITAX } from '../theme';
import { Marca } from './Marca';
import { ROTULO_PERFIL } from './rotulos';

const MENU: { rotulo: string; para: string; icone: typeof IconInbox; perfis?: Perfil[] }[] = [
  { rotulo: 'Minhas pendências', para: '/pendencias', icone: IconInbox },
  { rotulo: 'Importar NF-es', para: '/importar', icone: IconFileImport, perfis: ['ADMIN', 'REVISOR'] },
  { rotulo: 'Notas fiscais', para: '/notas', icone: IconFileInvoice, perfis: ['ADMIN', 'REVISOR'] },
  { rotulo: 'Acompanhamento', para: '/acompanhamento', icone: IconListCheck, perfis: ['ADMIN', 'REVISOR'] },
  { rotulo: 'Painel', para: '/painel', icone: IconChartBar, perfis: ['ADMIN', 'REVISOR'] },
  { rotulo: 'Cadastros', para: '/cadastros', icone: IconSettings, perfis: ['ADMIN'] },
];

export function Layout() {
  const [aberto, { toggle, close }] = useDisclosure();
  const { usuario, sair, temPerfil } = useAuth();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !aberto } }}
      padding="md"
    >
      <AppShell.Header bg={CORES_ITAX.chumbo} withBorder={false}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={aberto}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="white"
              aria-label="Abrir menu"
            />
            <Marca />
          </Group>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <UnstyledButton aria-label="Menu do usuário">
                <Group gap={8} wrap="nowrap">
                  <Avatar color="itaxRed" radius="xl" size={32}>
                    {usuario?.nome.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Stack gap={0} visibleFrom="sm">
                    <Text c="white" fz="sm" fw={600}>
                      {usuario?.nome}
                    </Text>
                    <Text c={CORES_ITAX.cinzaClaro} fz="xs">
                      {usuario && ROTULO_PERFIL[usuario.perfil]}
                      {usuario?.setor ? ` · ${usuario.setor.nome}` : ''}
                    </Text>
                  </Stack>
                  <IconChevronDown size={16} color="white" stroke={1.5} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconLogout size={16} stroke={1.5} />} onClick={sair}>
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {MENU.filter((m) => !m.perfis || temPerfil(...m.perfis)).map((m) => (
            <NavLink
              key={m.para}
              component={RouterLink}
              to={m.para}
              label={m.rotulo}
              leftSection={<m.icone size={20} stroke={1.5} />}
              active={pathname.startsWith(m.para)}
              onClick={close}
              style={{ borderRadius: 8, fontWeight: 600 }}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
