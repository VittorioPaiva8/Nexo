import { Button, Card, Group, Pagination, Select, SimpleGrid, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconFileImport, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCadastros } from '../api/cadastros';
import { api } from '../api/cliente';
import type { Contadores, Divergencia } from '../api/tipos';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { Carregando, ErroCarregar, Vazio } from '../components/Estado';
import { STATUS_DIVERGENCIA } from '../components/rotulos';
import { TabelaDivergencias } from '../components/TabelaDivergencias';
import { Cabecalho, Kpi } from '../components/ui';

const POR_PAGINA = 20;
const dois = (n: number | undefined) => (n === undefined ? '—' : String(n).padStart(2, '0'));

export function Central() {
  const navigate = useNavigate();
  const { temPerfil } = useAuth();
  const fiscal = temPerfil('FISCAL', 'GESTOR', 'ADMIN');
  const cadastros = useCadastros();
  const [busca, setBusca] = useState('');
  const [buscaAtiva] = useDebouncedValue(busca, 300);
  const [status, setStatus] = useState<string | null>(null);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const contadores = useApi(() => api.get<Contadores>('/divergencias/contadores'), []);
  const lista = useApi(
    () =>
      api.pagina<Divergencia>('/divergencias', {
        escopo: 'todas',
        busca: buscaAtiva,
        status: status === 'ATRASADA' ? undefined : status,
        atrasadas: status === 'ATRASADA' || undefined,
        setorId,
        pagina,
        porPagina: POR_PAGINA,
      }),
    [buscaAtiva, status, setorId, pagina],
  );
  const c = contadores.dados;

  return (
    <>
      <Cabecalho
        sobretitulo="Controle de notas"
        titulo="Central de divergências"
        descricao="Consulte, filtre e acompanhe cada nota, responsável e prazo."
        acoes={
          fiscal && (
            <>
              <Button
                variant="default"
                leftSection={<IconFileImport size={16} />}
                onClick={() => navigate('/importar')}
              >
                Importar lote
              </Button>
              <Button onClick={() => navigate('/nova')}>+ Nova divergência</Button>
            </>
          )
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Kpi
          rotulo="Pendentes de tratativa"
          valor={dois(c?.pendentes)}
          rodape="Aguardando o responsável assumir"
        />
        <Kpi
          rotulo="Devolvidas ao Fiscal"
          valor={dois(c?.devolvidas)}
          rodape="Exigem validação do lançamento"
        />
        <Kpi
          rotulo="Fora do prazo"
          valor={dois(c?.atrasadas)}
          rodape="Prioridade para a equipe"
          destaque={Boolean(c?.atrasadas)}
        />
      </SimpleGrid>

      <Card withBorder p={0}>
        <Group p="md" gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <TextInput
            style={{ flex: 1, minWidth: 240 }}
            leftSection={<IconSearch size={16} />}
            placeholder="Buscar por nota fiscal, chave de acesso, fornecedor ou protocolo..."
            value={busca}
            onChange={(e) => {
              setBusca(e.currentTarget.value);
              setPagina(1);
            }}
          />
          <Select
            w={200}
            placeholder="Todos os status"
            clearable
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPagina(1);
            }}
            data={[
              ...Object.entries(STATUS_DIVERGENCIA).map(([value, s]) => ({ value, label: s.rotulo })),
              { value: 'ATRASADA', label: 'Atrasada' },
            ]}
          />
          <Select
            w={180}
            placeholder="Todos os setores"
            clearable
            value={setorId}
            onChange={(v) => {
              setSetorId(v);
              setPagina(1);
            }}
            data={(cadastros?.setores ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
          />
        </Group>
        {lista.carregando && <Carregando />}
        {lista.erro && <ErroCarregar mensagem={lista.erro} />}
        {lista.dados && lista.dados.data.length === 0 && (
          <Vazio titulo="Nenhuma divergência encontrada">
            Ajuste os filtros ou cadastre uma nova divergência.
          </Vazio>
        )}
        {lista.dados && lista.dados.data.length > 0 && <TabelaDivergencias itens={lista.dados.data} />}
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Text fz="xs" c="dimmed">
            Exibindo {lista.dados?.data.length ?? 0} de {lista.dados?.meta.total ?? 0} tratativas • cada
            divergência possui seu próprio protocolo e histórico.
          </Text>
          {lista.dados && lista.dados.meta.total > POR_PAGINA && (
            <Pagination
              size="sm"
              value={pagina}
              onChange={setPagina}
              total={Math.ceil(lista.dados.meta.total / POR_PAGINA)}
            />
          )}
        </Group>
      </Card>
    </>
  );
}
