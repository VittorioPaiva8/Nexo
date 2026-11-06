import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { invalidarCadastros } from '../api/cadastros';
import { api } from '../api/cliente';
import type { ConfigAviso, Perfil, Setor, TipoDivergencia, Usuario } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Carregando, ErroCarregar } from '../components/Estado';
import { DESCRICAO_PERFIL, ROTULO_PERFIL } from '../components/rotulos';
import { Cabecalho, Estatistica, Painel } from '../components/ui';

function UsuarioModal({
  usuario,
  setores,
  aoFechar,
  aoSalvar,
}: {
  usuario: Usuario | 'novo' | null;
  setores: Setor[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const novo = usuario === 'novo';
  const atual = usuario && usuario !== 'novo' ? usuario : null;
  const [erro, setErro] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      nome: atual?.nome ?? '',
      email: atual?.email ?? '',
      senha: '',
      perfil: (atual?.perfil ?? 'TRATADOR') as Perfil,
      setorId: atual?.setorId ? String(atual.setorId) : (null as string | null),
      ativo: atual?.ativo ?? true,
    },
    validate: {
      nome: (v) => (v.trim().length >= 2 ? null : 'Informe o nome'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Informe um e-mail válido'),
      senha: (v) =>
        novo && v.length < 6 ? 'Mínimo de 6 caracteres' : v && v.length < 6 ? 'Mínimo de 6 caracteres' : null,
      setorId: (v, valores) => (valores.perfil === 'TRATADOR' && !v ? 'Tratador precisa de um setor' : null),
    },
  });

  const salvar = form.onSubmit(async (v) => {
    setErro(null);
    const corpo = {
      nome: v.nome,
      email: v.email,
      perfil: v.perfil,
      setorId: v.setorId ? Number(v.setorId) : null,
      ...(v.senha ? { senha: v.senha } : {}),
      ...(novo ? {} : { ativo: v.ativo }),
    };
    try {
      if (novo) await api.post('/usuarios', { ...corpo, setorId: corpo.setorId ?? undefined });
      else await api.patch(`/usuarios/${atual!.id}`, corpo);
      notifications.show({ color: 'green', message: 'Usuário salvo.' });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  });

  return (
    <Modal
      opened={usuario !== null}
      onClose={aoFechar}
      title={novo ? 'Cadastrar usuário' : 'Editar usuário'}
      centered
    >
      <form onSubmit={salvar}>
        <Stack>
          <TextInput label="Nome" withAsterisk {...form.getInputProps('nome')} />
          <TextInput label="E-mail" withAsterisk {...form.getInputProps('email')} />
          <PasswordInput
            label={novo ? 'Senha inicial' : 'Nova senha (opcional)'}
            withAsterisk={novo}
            {...form.getInputProps('senha')}
          />
          <SimpleGrid cols={2}>
            <Select
              label="Perfil"
              allowDeselect={false}
              data={(Object.keys(ROTULO_PERFIL) as Perfil[]).map((p) => ({
                value: p,
                label: ROTULO_PERFIL[p],
              }))}
              {...form.getInputProps('perfil')}
            />
            <Select
              label="Setor principal"
              clearable
              data={setores.map((s) => ({ value: String(s.id), label: s.nome }))}
              {...form.getInputProps('setorId')}
            />
          </SimpleGrid>
          {!novo && <Switch label="Usuário ativo" {...form.getInputProps('ativo', { type: 'checkbox' })} />}
          {erro && <Alert color="itaxRed">{erro}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function SetorModal({
  setor,
  aoFechar,
  aoSalvar,
}: {
  setor: Setor | 'novo' | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const atual = setor && setor !== 'novo' ? setor : null;
  const [erro, setErro] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      nome: atual?.nome ?? '',
      descricao: atual?.descricao ?? '',
      slaDias: atual?.slaDias ?? 2,
      ativo: atual?.ativo ?? true,
    },
    validate: { nome: (v) => (v.trim().length >= 2 ? null : 'Informe o nome') },
  });
  const salvar = form.onSubmit(async (v) => {
    setErro(null);
    try {
      if (atual) await api.patch(`/setores/${atual.id}`, { ...v, slaDias: Number(v.slaDias) });
      else
        await api.post('/setores', {
          nome: v.nome,
          descricao: v.descricao || undefined,
          slaDias: Number(v.slaDias),
        });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  });
  return (
    <Modal opened={setor !== null} onClose={aoFechar} title={atual ? 'Editar setor' : 'Novo setor'} centered>
      <form onSubmit={salvar}>
        <Stack>
          <TextInput label="Nome" withAsterisk {...form.getInputProps('nome')} />
          <TextInput
            label="Descrição"
            placeholder="Ex.: Pedidos e fornecedores"
            {...form.getInputProps('descricao')}
          />
          <NumberInput
            label="SLA padrão (dias corridos)"
            description="Prazo usado quando a divergência é cadastrada sem data"
            min={0}
            max={60}
            {...form.getInputProps('slaDias')}
          />
          {atual && <Switch label="Setor ativo" {...form.getInputProps('ativo', { type: 'checkbox' })} />}
          {erro && <Alert color="itaxRed">{erro}</Alert>}
          <Group justify="flex-end">
            <Button type="submit">Salvar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function TipoModal({
  tipo,
  setores,
  aoFechar,
  aoSalvar,
}: {
  tipo: TipoDivergencia | 'novo' | null;
  setores: Setor[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const atual = tipo && tipo !== 'novo' ? tipo : null;
  const [erro, setErro] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      nome: atual?.nome ?? '',
      setorOrigemId: atual?.setorOrigemId ? String(atual.setorOrigemId) : (null as string | null),
      ativo: atual?.ativo ?? true,
    },
    validate: { nome: (v) => (v.trim().length >= 2 ? null : 'Informe o nome') },
  });
  const salvar = form.onSubmit(async (v) => {
    setErro(null);
    const corpo = { nome: v.nome, setorOrigemId: v.setorOrigemId ? Number(v.setorOrigemId) : null };
    try {
      if (atual) await api.patch(`/tipos-divergencia/${atual.id}`, { ...corpo, ativo: v.ativo });
      else
        await api.post('/tipos-divergencia', { ...corpo, setorOrigemId: corpo.setorOrigemId ?? undefined });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  });
  return (
    <Modal
      opened={tipo !== null}
      onClose={aoFechar}
      title={atual ? 'Editar tipo de divergência' : 'Novo tipo de divergência'}
      centered
    >
      <form onSubmit={salvar}>
        <Stack>
          <TextInput label="Nome" withAsterisk {...form.getInputProps('nome')} />
          <Select
            label="Setor de origem"
            description="Sugere o setor responsável no cadastro"
            clearable
            data={setores.map((s) => ({ value: String(s.id), label: s.nome }))}
            {...form.getInputProps('setorOrigemId')}
          />
          {atual && <Switch label="Tipo ativo" {...form.getInputProps('ativo', { type: 'checkbox' })} />}
          {erro && <Alert color="itaxRed">{erro}</Alert>}
          <Group justify="flex-end">
            <Button type="submit">Salvar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function salvo(recarregar: () => Promise<void>, fechar: () => void) {
  invalidarCadastros();
  fechar();
  void recarregar();
}

export function Usuarios() {
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<string | null>(null);
  const [editUsuario, setEditUsuario] = useState<Usuario | 'novo' | null>(null);
  const [editSetor, setEditSetor] = useState<Setor | 'novo' | null>(null);
  const [editTipo, setEditTipo] = useState<TipoDivergencia | 'novo' | null>(null);
  const usuarios = useApi(() => api.get<Usuario[]>('/usuarios', { incluirInativos: true }), []);
  const setores = useApi(() => api.get<Setor[]>('/setores'), []);
  const tipos = useApi(() => api.get<TipoDivergencia[]>('/tipos-divergencia'), []);
  const avisos = useApi(() => api.get<ConfigAviso[]>('/notificacoes/configuracoes'), []);

  if (usuarios.carregando && !usuarios.dados) return <Carregando />;
  if (usuarios.erro) return <ErroCarregar mensagem={usuarios.erro} />;

  const termo = busca.trim().toLowerCase();
  const lista = (usuarios.dados ?? []).filter(
    (u) =>
      (!filtroSetor || String(u.setorId) === filtroSetor) &&
      (!termo || `${u.nome} ${u.email} ${u.setor?.nome ?? ''}`.toLowerCase().includes(termo)),
  );
  const listaSetores = setores.dados ?? [];

  async function alternarAviso(a: ConfigAviso) {
    try {
      avisos.setDados(
        await api.patch<ConfigAviso[]>(`/notificacoes/configuracoes/${a.evento}`, { ativo: !a.ativo }),
      );
    } catch (e) {
      notifications.show({ color: 'itaxRed', message: e instanceof Error ? e.message : 'Erro ao salvar' });
    }
  }

  return (
    <>
      <Cabecalho
        sobretitulo="Administração"
        titulo="Usuários, setores e notificações"
        descricao="Cadastre usuários, vincule perfis aos setores e defina disparos automáticos de avisos."
        acoes={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditUsuario('novo')}>
            Cadastrar novo usuário
          </Button>
        }
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <Painel titulo="Usuários e respectivas permissões" semPadding>
              <Group p="md" gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <TextInput
                  style={{ flex: 1 }}
                  leftSection={<IconSearch size={16} />}
                  placeholder="Pesquisar por nome, e-mail ou setor..."
                  value={busca}
                  onChange={(e) => setBusca(e.currentTarget.value)}
                />
                <Select
                  w={180}
                  placeholder="Todos os setores"
                  clearable
                  value={filtroSetor}
                  onChange={setFiltroSetor}
                  data={listaSetores.map((s) => ({ value: String(s.id), label: s.nome }))}
                />
              </Group>
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" fz="sm" highlightOnHover>
                  <Table.Thead bg="gray.0">
                    <Table.Tr>
                      <Table.Th>Nome</Table.Th>
                      <Table.Th>E-mail</Table.Th>
                      <Table.Th>Setor</Table.Th>
                      <Table.Th>Perfil</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lista.map((u) => (
                      <Table.Tr key={u.id} className="linha-clicavel" onClick={() => setEditUsuario(u)}>
                        <Table.Td fw={700}>{u.nome}</Table.Td>
                        <Table.Td>{u.email}</Table.Td>
                        <Table.Td>{u.setor?.nome ?? '—'}</Table.Td>
                        <Table.Td>{ROTULO_PERFIL[u.perfil]}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" radius="xl" color={u.ativo ? 'green' : 'gray'}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Painel>
            <Painel titulo="Regras de acesso">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {(Object.keys(DESCRICAO_PERFIL) as Perfil[]).map((p) => (
                  <Estatistica key={p} valor={ROTULO_PERFIL[p]} legenda={DESCRICAO_PERFIL[p]} />
                ))}
              </SimpleGrid>
            </Painel>
            <Painel
              titulo="Tipos de divergência"
              extra={
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setEditTipo('novo')}
                >
                  Novo tipo
                </Button>
              }
              semPadding
            >
              <Table verticalSpacing={6} fz="sm">
                <Table.Tbody>
                  {(tipos.dados ?? []).map((t) => (
                    <Table.Tr key={t.id} className="linha-clicavel" onClick={() => setEditTipo(t)}>
                      <Table.Td pl="lg" c={t.ativo ? undefined : 'dimmed'}>
                        {t.nome}
                      </Table.Td>
                      <Table.Td c="dimmed">{t.setorOrigem?.nome ?? '—'}</Table.Td>
                      <Table.Td pr="lg" ta="right">
                        {!t.ativo && <Badge color="gray">Inativo</Badge>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Painel>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Painel titulo="Preferências de notificação">
              <Stack gap="md">
                {(avisos.dados ?? []).map((a) => (
                  <Group key={a.evento} justify="space-between" wrap="nowrap">
                    <div>
                      <Text fz="sm" fw={700}>
                        {a.titulo}
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {a.descricao}
                      </Text>
                    </div>
                    <Switch
                      checked={a.ativo}
                      onChange={() => alternarAviso(a)}
                      color="itaxRed"
                      aria-label={a.titulo}
                    />
                  </Group>
                ))}
                <Text fz="xs" c="dimmed">
                  Os avisos ficam registrados no sistema (sino no topo). O envio por e-mail exige integração
                  com o serviço corporativo (SMTP ou API); até lá, cada aviso é marcado como não enviado.
                </Text>
              </Stack>
            </Painel>
            <Painel
              titulo="Setores cadastrados"
              extra={
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setEditSetor('novo')}
                >
                  Novo setor
                </Button>
              }
            >
              <SimpleGrid cols={2}>
                {listaSetores.map((s) => (
                  <Estatistica
                    key={s.id}
                    valor={
                      <Group gap={4} justify="space-between" wrap="nowrap">
                        <span style={{ opacity: s.ativo ? 1 : 0.5 }}>{s.nome}</span>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          onClick={() => setEditSetor(s)}
                          aria-label={`Editar ${s.nome}`}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                      </Group>
                    }
                    legenda={`${s.descricao ?? 'Sem descrição'} · SLA ${s.slaDias} dia(s) · ${s._count?.usuarios ?? 0} usuário(s)`}
                  />
                ))}
              </SimpleGrid>
            </Painel>
          </Stack>
        </Grid.Col>
      </Grid>
      <UsuarioModal
        key={editUsuario === 'novo' ? 'novo' : (editUsuario?.id ?? 'fechado-usuario')}
        usuario={editUsuario}
        setores={listaSetores.filter((s) => s.ativo)}
        aoFechar={() => setEditUsuario(null)}
        aoSalvar={() => salvo(usuarios.recarregar, () => setEditUsuario(null))}
      />
      <SetorModal
        key={editSetor === 'novo' ? 'novo-setor' : (editSetor?.id ?? 'fechado-setor')}
        setor={editSetor}
        aoFechar={() => setEditSetor(null)}
        aoSalvar={() => salvo(setores.recarregar, () => setEditSetor(null))}
      />
      <TipoModal
        key={editTipo === 'novo' ? 'novo-tipo' : (editTipo?.id ?? 'fechado-tipo')}
        tipo={editTipo}
        setores={listaSetores}
        aoFechar={() => setEditTipo(null)}
        aoSalvar={() => salvo(tipos.recarregar, () => setEditTipo(null))}
      />
    </>
  );
}
