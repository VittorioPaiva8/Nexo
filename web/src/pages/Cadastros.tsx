import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '../api/cliente';
import type { Perfil, Setor, TipoDivergencia, Usuario } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Carregando, ErroCarregar } from '../components/Estado';
import { ROTULO_PERFIL } from '../components/rotulos';
import { Titulo } from '../components/Titulo';

function avisarErro(e: unknown) {
  notifications.show({ color: 'itaxRed', message: e instanceof Error ? e.message : 'Erro ao salvar' });
}

function Usuarios() {
  const usuarios = useApi(() => api.get<Usuario[]>('/usuarios', { incluirInativos: true }), []);
  const setores = useApi(() => api.get<Setor[]>('/setores'), []);
  const [editando, setEditando] = useState<Usuario | 'novo' | null>(null);
  const form = useForm({
    initialValues: {
      nome: '',
      email: '',
      senha: '',
      perfil: 'RESPONSAVEL' as Perfil,
      setorId: '' as string,
      ativo: true,
    },
    validate: {
      nome: (v) => (v.trim().length >= 2 ? null : 'Informe o nome'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'E-mail inválido'),
      senha: (v) =>
        editando === 'novo' && v.length < 6
          ? 'Mínimo de 6 caracteres'
          : v && v.length < 6
            ? 'Mínimo de 6 caracteres'
            : null,
      setorId: (v, valores) =>
        valores.perfil === 'RESPONSAVEL' && !v ? 'Responsáveis precisam de um setor' : null,
    },
  });

  function abrir(u: Usuario | 'novo') {
    setEditando(u);
    form.setValues(
      u === 'novo'
        ? { nome: '', email: '', senha: '', perfil: 'RESPONSAVEL', setorId: '', ativo: true }
        : {
            nome: u.nome,
            email: u.email,
            senha: '',
            perfil: u.perfil,
            setorId: u.setorId ? String(u.setorId) : '',
            ativo: u.ativo,
          },
    );
  }

  const salvar = form.onSubmit(async (v) => {
    const corpo = {
      nome: v.nome,
      email: v.email,
      perfil: v.perfil,
      setorId: v.setorId ? Number(v.setorId) : editando === 'novo' ? undefined : null,
      ...(v.senha ? { senha: v.senha } : {}),
      ...(editando !== 'novo' ? { ativo: v.ativo } : {}),
    };
    try {
      if (editando === 'novo') await api.post('/usuarios', corpo);
      else if (editando) await api.patch(`/usuarios/${editando.id}`, corpo);
      setEditando(null);
      void usuarios.recarregar();
    } catch (e) {
      avisarErro(e);
    }
  });

  if (usuarios.carregando) return <Carregando />;
  if (usuarios.erro) return <ErroCarregar mensagem={usuarios.erro} />;

  return (
    <Stack>
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={() => abrir('novo')}>
          Novo usuário
        </Button>
      </Group>
      <Card p={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Perfil</Table.Th>
                <Table.Th>Setor</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {usuarios.dados?.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>
                    <Text fz="sm" fw={600}>
                      {u.nome}
                    </Text>
                    <Text fz="xs" c="dimmed">
                      {u.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>{ROTULO_PERFIL[u.perfil]}</Table.Td>
                  <Table.Td>{u.setor?.nome ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={u.ativo ? 'green' : 'gray'}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Editar">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => abrir(u)}
                        aria-label={`Editar ${u.nome}`}
                      >
                        <IconPencil size={16} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal
        opened={editando !== null}
        onClose={() => setEditando(null)}
        title={editando === 'novo' ? 'Novo usuário' : 'Editar usuário'}
      >
        <form onSubmit={salvar}>
          <Stack>
            <TextInput label="Nome" {...form.getInputProps('nome')} />
            <TextInput label="E-mail" {...form.getInputProps('email')} />
            <PasswordInput
              label={editando === 'novo' ? 'Senha' : 'Nova senha (deixe em branco para manter)'}
              {...form.getInputProps('senha')}
            />
            <Select
              label="Perfil"
              data={(Object.keys(ROTULO_PERFIL) as Perfil[]).map((p) => ({
                value: p,
                label: ROTULO_PERFIL[p],
              }))}
              allowDeselect={false}
              {...form.getInputProps('perfil')}
            />
            <Select
              label="Setor"
              clearable
              data={(setores.dados ?? [])
                .filter((s) => s.ativo)
                .map((s) => ({ value: String(s.id), label: s.nome }))}
              {...form.getInputProps('setorId')}
            />
            {editando !== 'novo' && (
              <Switch label="Ativo" {...form.getInputProps('ativo', { type: 'checkbox' })} />
            )}
            <Group justify="flex-end">
              <Button type="submit">Salvar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

/** Cadastro simples de nome + ativo (setores e tipos de divergência). */
function CadastroSimples({ caminho, rotulo }: { caminho: string; rotulo: string }) {
  const lista = useApi(() => api.get<(Setor | TipoDivergencia)[]>(caminho), [caminho]);
  const [novo, setNovo] = useState('');

  async function criar() {
    if (novo.trim().length < 2) return;
    try {
      await api.post(caminho, { nome: novo });
      setNovo('');
      void lista.recarregar();
    } catch (e) {
      avisarErro(e);
    }
  }

  async function alternar(item: Setor | TipoDivergencia) {
    try {
      await api.patch(`${caminho}/${item.id}`, { ativo: !item.ativo });
      void lista.recarregar();
    } catch (e) {
      avisarErro(e);
    }
  }

  if (lista.carregando) return <Carregando />;
  if (lista.erro) return <ErroCarregar mensagem={lista.erro} />;

  return (
    <Stack maw={640}>
      <Group align="flex-end">
        <TextInput
          label={`Novo ${rotulo}`}
          value={novo}
          onChange={(e) => setNovo(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void criar()}
          style={{ flex: 1 }}
        />
        <Button onClick={criar} leftSection={<IconPlus size={16} />}>
          Adicionar
        </Button>
      </Group>
      <Card p={0}>
        <Table verticalSpacing="sm">
          <Table.Tbody>
            {lista.dados?.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td c={item.ativo ? undefined : 'dimmed'}>{item.nome}</Table.Td>
                <Table.Td w={120}>
                  <Switch
                    checked={item.ativo}
                    onChange={() => alternar(item)}
                    label={item.ativo ? 'Ativo' : 'Inativo'}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

export function Cadastros() {
  return (
    <Stack>
      <Titulo titulo="Cadastros" descricao="Usuários, setores e tipos de divergência." />
      <Tabs defaultValue="usuarios" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="usuarios">Usuários</Tabs.Tab>
          <Tabs.Tab value="setores">Setores</Tabs.Tab>
          <Tabs.Tab value="tipos">Tipos de divergência</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="usuarios">
          <Usuarios />
        </Tabs.Panel>
        <Tabs.Panel value="setores">
          <CadastroSimples caminho="/setores" rotulo="setor" />
        </Tabs.Panel>
        <Tabs.Panel value="tipos">
          <CadastroSimples caminho="/tipos-divergencia" rotulo="tipo de divergência" />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
