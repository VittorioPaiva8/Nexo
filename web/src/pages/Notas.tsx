import {
  Anchor,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconDownload, IconSearch, IconSend } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import type { Divergencia, NotaFiscal, Pagina, StatusNota } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EncaminharModal } from '../components/EncaminharModal';
import { Carregando, ErroCarregar, Vazio } from '../components/Estado';
import { BadgeDivergencia, BadgeNota } from '../components/rotulos';
import { TabelaNotas } from '../components/TabelaNotas';
import { Titulo } from '../components/Titulo';
import { formatarChave, formatarCnpj, formatarData, formatarMoeda } from '../utils/formato';

const POR_PAGINA = 20;

type NotaDetalhe = NotaFiscal & { divergencias: Divergencia[] };

function DetalheNota({ id }: { id: number }) {
  const { dados, carregando, erro } = useApi(() => api.get<NotaDetalhe>(`/notas/${id}`), [id]);
  if (carregando) return <Carregando />;
  if (erro || !dados) return <ErroCarregar mensagem={erro ?? ''} />;
  return (
    <Stack>
      <Group justify="space-between">
        <BadgeNota status={dados.status} />
        <Button
          variant="default"
          size="xs"
          leftSection={<IconDownload size={14} />}
          onClick={() => api.baixar(`/notas/${id}/xml`, `${dados.chaveAcesso}.xml`)}
        >
          Baixar XML
        </Button>
      </Group>
      <Stack gap={2}>
        <Text fz="xs" c="dimmed">
          Chave de acesso
        </Text>
        <Text fz="sm" ff="monospace">
          {formatarChave(dados.chaveAcesso)}
        </Text>
      </Stack>
      <Group grow>
        <Stack gap={2}>
          <Text fz="xs" c="dimmed">
            Emissão
          </Text>
          <Text fz="sm">{formatarData(dados.dataEmissao)}</Text>
        </Stack>
        <Stack gap={2}>
          <Text fz="xs" c="dimmed">
            Valor total
          </Text>
          <Text fz="sm" fw={600}>
            {formatarMoeda(dados.valorTotal)}
          </Text>
        </Stack>
      </Group>
      <Stack gap={2}>
        <Text fz="xs" c="dimmed">
          Emitente
        </Text>
        <Text fz="sm">
          {dados.emitenteNome} · {formatarCnpj(dados.emitenteCnpj)}
        </Text>
      </Stack>
      {dados.naturezaOperacao && (
        <Stack gap={2}>
          <Text fz="xs" c="dimmed">
            Natureza da operação
          </Text>
          <Text fz="sm">{dados.naturezaOperacao}</Text>
        </Stack>
      )}
      <Divider label="Divergências" labelPosition="left" />
      {dados.divergencias.length === 0 && (
        <Text c="dimmed" fz="sm">
          Nenhuma divergência registrada.
        </Text>
      )}
      {dados.divergencias.map((d) => (
        <Card key={d.id} p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Anchor component={Link} to={`/divergencias/${d.id}`} fw={600} fz="sm">
              {d.tipo.nome}
            </Anchor>
            <BadgeDivergencia status={d.status} />
          </Group>
          <Text fz="xs" c="dimmed">
            Aberta em {formatarData(d.abertaEm)} · com {d.responsavelAtual?.nome ?? '—'}
          </Text>
        </Card>
      ))}
    </Stack>
  );
}

export function Notas() {
  const [pagina, setPagina] = useState(1);
  const [status, setStatus] = useState<StatusNota | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAtrasada] = useDebouncedValue(busca, 350);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [aberta, setAberta] = useState<NotaFiscal | null>(null);
  const [modal, { open, close }] = useDisclosure();

  const { dados, carregando, erro, recarregar } = useApi(
    () => api.pagina<NotaFiscal>('/notas', { pagina, porPagina: POR_PAGINA, status, busca: buscaAtrasada }),
    [pagina, status, buscaAtrasada],
  );
  const resultado = dados as Pagina<NotaFiscal> | null;

  return (
    <Stack>
      <Titulo
        titulo="Notas fiscais"
        descricao="Todas as NF-es importadas. Selecione as que têm problema para encaminhar."
        acoes={
          <Button leftSection={<IconSend size={16} />} disabled={selecionadas.length === 0} onClick={open}>
            Encaminhar {selecionadas.length > 0 ? `(${selecionadas.length})` : ''}
          </Button>
        }
      />
      <Group grow preventGrowOverflow={false} wrap="wrap">
        <TextInput
          placeholder="Número, chave, CNPJ ou emitente"
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => {
            setBusca(e.currentTarget.value);
            setPagina(1);
          }}
          miw={220}
        />
        <Select
          placeholder="Todas as situações"
          clearable
          data={[
            { value: 'IMPORTADA', label: 'Sem pendência' },
            { value: 'EM_AJUSTE', label: 'Em ajuste' },
            { value: 'AJUSTADA', label: 'Ajustada' },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v as StatusNota | null);
            setPagina(1);
          }}
          maw={240}
        />
      </Group>
      <Card p={0}>
        {carregando && <Carregando />}
        {erro && <ErroCarregar mensagem={erro} />}
        {resultado && !carregando && resultado.data.length === 0 && (
          <Vazio titulo="Nenhuma nota encontrada">Importe XMLs na tela Importar NF-es.</Vazio>
        )}
        {resultado && !carregando && resultado.data.length > 0 && (
          <TabelaNotas
            notas={resultado.data}
            selecionadas={selecionadas}
            aoSelecionar={setSelecionadas}
            aoAbrir={setAberta}
          />
        )}
      </Card>
      {resultado && resultado.meta.total > POR_PAGINA && (
        <Group justify="space-between">
          <Text fz="sm" c="dimmed">
            {resultado.meta.total} notas
          </Text>
          <Pagination
            value={pagina}
            onChange={setPagina}
            total={Math.ceil(resultado.meta.total / POR_PAGINA)}
          />
        </Group>
      )}

      <Drawer
        opened={aberta !== null}
        onClose={() => setAberta(null)}
        position="right"
        title={aberta ? `NF-e ${aberta.numero} · série ${aberta.serie}` : ''}
      >
        {aberta && <DetalheNota id={aberta.id} />}
      </Drawer>

      <EncaminharModal
        notaIds={selecionadas}
        aberto={modal}
        aoFechar={close}
        aoConcluir={() => {
          close();
          setSelecionadas([]);
          void recarregar();
        }}
      />
    </Stack>
  );
}
