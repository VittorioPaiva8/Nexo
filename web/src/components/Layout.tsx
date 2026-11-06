import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Group,
  Indicator,
  Menu,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBell,
  IconChartBar,
  IconChecklist,
  IconCirclePlus,
  IconFileImport,
  IconLayoutDashboard,
  IconListDetails,
  IconLogout,
  IconSettings,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { Contadores, Notificacao, Perfil } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { CORES_ITAX } from '../theme';
import { formatarDataHora } from '../utils/formato';
import { Marca } from './Marca';
import { ROTULO_PERFIL } from './rotulos';

const FISCAIS: Perfil[] = ['FISCAL', 'GESTOR', 'ADMIN'];

const EVENTO_ATUALIZAR = 'fluxo-fiscal:atualizar';
/** Avisa o menu lateral para recarregar os contadores depois de uma ação. */
export const avisarMudanca = () => window.dispatchEvent(new Event(EVENTO_ATUALIZAR));

interface ItemMenu {
  rotulo: string;
  para: string;
  icone: typeof IconBell;
  perfis?: Perfil[];
  contador?: keyof Contadores;
}

const SECOES: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: 'Fluxo Fiscal',
    itens: [
      { rotulo: 'Painel geral', para: '/painel', icone: IconLayoutDashboard, perfis: FISCAIS },
      { rotulo: 'Divergências', para: '/divergencias', icone: IconListDetails, contador: 'pendentes' },
      { rotulo: 'Nova divergência', para: '/nova', icone: IconCirclePlus, perfis: FISCAIS },
      { rotulo: 'Importar lote', para: '/importar', icone: IconFileImport, perfis: FISCAIS },
      { rotulo: 'Minhas tratativas', para: '/tratativas', icone: IconChecklist, contador: 'minhas' },
      {
        rotulo: 'Validação fiscal',
        para: '/validacao',
        icone: IconShieldCheck,
        perfis: FISCAIS,
        contador: 'devolvidas',
      },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { rotulo: 'Relatórios e SLA', para: '/relatorios', icone: IconChartBar, perfis: FISCAIS },
      { rotulo: 'Usuários e setores', para: '/usuarios', icone: IconSettings, perfis: ['ADMIN'] },
    ],
  },
];

const TODOS = SECOES.flatMap((s) => s.itens);

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function Avisos() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [avisos, setAvisos] = useState<{ itens: Notificacao[]; naoLidas: number }>({
    itens: [],
    naoLidas: 0,
  });

  useEffect(() => {
    api
      .get<typeof avisos>('/notificacoes')
      .then(setAvisos)
      .catch(() => undefined);
  }, [pathname]);

  const abrir = useCallback(async () => {
    if (avisos.naoLidas === 0) return;
    await api.post('/notificacoes/lidas').catch(() => undefined);
    setAvisos((a) => ({ ...a, naoLidas: 0 }));
  }, [avisos.naoLidas]);

  return (
    <Menu position="bottom-end" width={340} onOpen={abrir} withinPortal>
      <Menu.Target>
        <Indicator
          label={avisos.naoLidas}
          size={16}
          color="itaxRed"
          disabled={avisos.naoLidas === 0}
          offset={4}
        >
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Avisos">
            <IconBell size={20} stroke={1.5} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Avisos</Menu.Label>
        {avisos.itens.length === 0 && (
          <Text fz="sm" c="dimmed" px="sm" py="xs">
            Nenhum aviso por enquanto.
          </Text>
        )}
        {avisos.itens.slice(0, 8).map((n) => (
          <Menu.Item
            key={n.id}
            onClick={() => n.divergenciaId && navigate(`/divergencias/${n.divergenciaId}`)}
          >
            <Text fz="sm" fw={n.lidaEm ? 400 : 700} lineClamp={2}>
              {n.assunto}
            </Text>
            <Text fz="xs" c="dimmed">
              {formatarDataHora(n.criadaEm)} · e-mail {n.situacao === 'ENVIADA' ? 'enviado' : 'não enviado'}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function Layout() {
  const [aberto, { toggle, close }] = useDisclosure();
  const { usuario, sair, temPerfil } = useAuth();
  const { pathname } = useLocation();
  const [contadores, setContadores] = useState<Contadores | null>(null);

  useEffect(() => {
    api
      .get<Contadores>('/divergencias/contadores')
      .then(setContadores)
      .catch(() => undefined);
  }, [pathname]);

  const atual = TODOS.find((i) => pathname.startsWith(i.para));
  const rotuloAtual = pathname.match(/^\/divergencias\/\d+/) ? 'Detalhe da divergência' : atual?.rotulo;

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 250, breakpoint: 'md', collapsed: { mobile: !aberto } }}
      padding={0}
    >
      <AppShell.Header withBorder>
        <Group h="100%" px={{ base: 'md', md: 'xl' }} justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger opened={aberto} onClick={toggle} hiddenFrom="md" size="sm" aria-label="Abrir menu" />
            <Text fz="sm" c="dimmed" truncate>
              <Box component="span" visibleFrom="sm">
                Grupo ITAX &nbsp;/&nbsp;{' '}
              </Box>
              <b style={{ color: CORES_ITAX.cinzaEscuro }}>Fluxo Fiscal</b>
              {rotuloAtual ? <> &nbsp;/&nbsp; {rotuloAtual}</> : null}
            </Text>
          </Group>
          <Group gap="md" wrap="nowrap">
            <Avisos />
            <Stack
              gap={0}
              visibleFrom="sm"
              pl="md"
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text fz="sm" fw={600}>
                {usuario?.nome}
              </Text>
              <Text fz="xs" c="dimmed">
                {usuario && ROTULO_PERFIL[usuario.perfil]}
                {usuario?.setor ? ` • ${usuario.setor.nome}` : ''}
              </Text>
            </Stack>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label="Menu do usuário">
                  <Avatar radius="xl" color="gray" size={36}>
                    {usuario ? iniciais(usuario.nome) : ''}
                  </Avatar>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{usuario?.email}</Menu.Label>
                <Menu.Item leftSection={<IconLogout size={16} stroke={1.5} />} onClick={sair}>
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar bg={CORES_ITAX.chumbo} withBorder={false} style={{ color: CORES_ITAX.cinzaClaro }}>
        <Box px="lg" py="lg" style={{ borderBottom: `1px solid ${CORES_ITAX.cinzaEscuro}` }}>
          <Link to="/" onClick={close} style={{ textDecoration: 'none' }}>
            <Marca />
          </Link>
          <Text fz={10} c={CORES_ITAX.cinzaMedio} mt={6} style={{ letterSpacing: 1.5 }}>
            GRUPO ITAX • SISTEMAS
          </Text>
        </Box>
        <ScrollArea style={{ flex: 1 }} px="sm">
          {SECOES.map((secao) => {
            const itens = secao.itens.filter((i) => !i.perfis || temPerfil(...i.perfis));
            if (itens.length === 0) return null;
            return (
              <Box key={secao.titulo}>
                <Text
                  fz={10}
                  fw={800}
                  c={CORES_ITAX.cinzaMedio}
                  px="sm"
                  pt="lg"
                  pb={6}
                  style={{ letterSpacing: 2 }}
                >
                  {secao.titulo.toUpperCase()}
                </Text>
                {itens.map((i) => {
                  const n = i.contador ? contadores?.[i.contador] : undefined;
                  return (
                    <NavLink key={i.para} to={i.para} onClick={close} className="item-menu">
                      <i.icone size={18} stroke={1.6} />
                      <span style={{ flex: 1 }}>{i.rotulo}</span>
                      {n ? (
                        <Badge size="sm" radius="xl" color="gray.1" c="itaxRed" className="contador-menu">
                          {n}
                        </Badge>
                      ) : null}
                    </NavLink>
                  );
                })}
              </Box>
            );
          })}
        </ScrollArea>
        <Group
          gap="sm"
          px="lg"
          py="md"
          wrap="nowrap"
          style={{ borderTop: `1px solid ${CORES_ITAX.cinzaEscuro}` }}
        >
          <Avatar radius="xl" color="gray" variant="filled" size={34}>
            {usuario ? iniciais(usuario.nome) : ''}
          </Avatar>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text fz="xs" fw={700} c="white" truncate>
              {usuario?.nome}
            </Text>
            <Text fz={11} c={CORES_ITAX.cinzaMedio} truncate>
              Fluxo Fiscal • {usuario && ROTULO_PERFIL[usuario.perfil]}
            </Text>
          </Stack>
          <ActionIcon variant="subtle" color="gray.5" onClick={sair} aria-label="Sair">
            <IconLogout size={18} stroke={1.5} />
          </ActionIcon>
        </Group>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Box px={{ base: 'md', md: 36 }} py={{ base: 'md', md: 30 }} maw={1600} mx="auto">
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
