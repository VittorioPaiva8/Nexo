import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  List,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconListDetails,
  IconSearch,
  IconSend,
  IconUpload,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { opcoesResponsaveis, useCadastros } from '../api/cadastros';
import { api } from '../api/cliente';
import type {
  Divergencia,
  NotaFiscal,
  Prioridade,
  RelatorioLote,
  ResultadoImportacaoXml,
} from '../api/tipos';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { Carregando, Vazio } from '../components/Estado';
import { ROTULO_PRIORIDADE } from '../components/rotulos';
import { TabelaNotas } from '../components/TabelaNotas';
import { Cabecalho, Estatistica, Painel } from '../components/ui';
import { formatarDia, formatarMoeda } from '../utils/formato';

const COLUNAS =
  'numero_nf;serie;cnpj_emissor;fornecedor;valor_total;tipo_divergencia;setor;responsavel;descricao;chave_acesso;prazo;prioridade';
const EXEMPLO =
  '000125;1;11.222.333/0001-81;Materiais Alfa Ltda.;10500,00;Sem pedido de compra;Suprimentos;;Nota sem pedido associado;;;Normal';

function baixarModelo() {
  const blob = new Blob([`﻿${COLUNAS}\n${EXEMPLO}\n`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Modelo_Importacao_ITAX_Fluxo_Fiscal.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const SITUACAO = {
  VALIDA: { rotulo: 'Válida', cor: 'green' },
  DUPLICADA: { rotulo: 'Duplicada', cor: 'gray' },
  INVALIDA: { rotulo: 'Com erro', cor: 'itaxRed' },
} as const;

function ImportacaoCsv() {
  const navigate = useNavigate();
  const cadastros = useCadastros();
  const { temPerfil } = useAuth();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prazo, setPrazo] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>('NORMAL');
  const [previa, setPrevia] = useState<RelatorioLote | null>(null);
  const [final, setFinal] = useState<RelatorioLote | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const responsaveis = useMemo(
    () =>
      opcoesResponsaveis(
        cadastros?.usuarios ?? [],
        setorId ? Number(setorId) : null,
        temPerfil('GESTOR', 'ADMIN'),
      ),
    [cadastros, setorId, temPerfil],
  );

  function corpo() {
    const f = new FormData();
    f.append('arquivo', arquivo!);
    if (setorId) f.append('setorId', setorId);
    if (responsavelId) f.append('responsavelId', responsavelId);
    if (prazo) f.append('prazo', dayjs(prazo).format('YYYY-MM-DD'));
    f.append('prioridade', prioridade);
    return f;
  }

  useEffect(() => {
    if (!arquivo) return;
    setErro(null);
    setFinal(null);
    setOcupado(true);
    api
      .post<RelatorioLote>('/importacoes/csv/previa', corpo())
      .then(setPrevia)
      .catch((e) => {
        setPrevia(null);
        setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo');
      })
      .finally(() => setOcupado(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo, setorId, responsavelId, prazo, prioridade]);

  async function confirmar() {
    setErro(null);
    setOcupado(true);
    try {
      const r = await api.post<RelatorioLote>('/importacoes/csv', corpo());
      setFinal(r);
      setPrevia(null);
      notifications.show({
        color: 'green',
        message: `${r.validas} tratativa(s) cadastrada(s) e distribuída(s).`,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar');
    } finally {
      setOcupado(false);
    }
  }

  const relatorio = final ?? previa;
  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <Stack gap="lg">
          <Painel titulo="1. Arquivo de importação">
            <Dropzone
              onDrop={(f) => setArquivo(f[0] ?? null)}
              loading={ocupado}
              multiple={false}
              maxSize={2 * 1024 * 1024}
              accept={{
                'text/csv': ['.csv'],
                'application/vnd.ms-excel': ['.csv'],
                'text/plain': ['.csv', '.txt'],
              }}
              onReject={() => setErro('Envie um arquivo .csv de até 2 MB.')}
            >
              <Stack align="center" gap={4} mih={120} justify="center" style={{ pointerEvents: 'none' }}>
                <IconUpload size={36} stroke={1.25} color="var(--mantine-color-gray-6)" />
                <Text fw={700}>{arquivo ? arquivo.name : 'Importe uma lista de notas com divergências'}</Text>
                <Text fz="sm" c="dimmed">
                  CSV separado por ponto e vírgula, formato UTF-8 (até 2.000 linhas)
                </Text>
              </Stack>
            </Dropzone>
            <Text fz="xs" c="dimmed" mt="sm">
              Colunas: numero_nf; serie; cnpj_emissor; fornecedor; valor_total; tipo_divergencia; setor;
              responsavel; descricao — opcionais: chave_acesso; data_emissao; prazo; prioridade;
              pedido_compra; centro_custo; unidade.
            </Text>
            <Anchor fz="sm" fw={700} c="itaxRed" mt="sm" display="inline-flex" onClick={baixarModelo}>
              <IconDownload size={16} /> &nbsp;Baixar modelo CSV de importação
            </Anchor>
          </Painel>
          <Painel titulo={final ? 'Relatório da importação' : '2. Conferência prévia do lote'} semPadding>
            {!relatorio && (
              <Alert m="lg" color="gray" variant="light">
                Ao importar, o sistema confere duplicidades, campos obrigatórios, CNPJ e chave de acesso antes
                do envio. Nada é gravado até você confirmar.
              </Alert>
            )}
            {relatorio && (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs" fz="sm">
                  <Table.Thead bg="gray.0">
                    <Table.Tr>
                      <Table.Th>Linha</Table.Th>
                      <Table.Th>NF</Table.Th>
                      <Table.Th>Fornecedor</Table.Th>
                      <Table.Th>Divergência</Table.Th>
                      <Table.Th>Destino</Table.Th>
                      <Table.Th>Validação</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {relatorio.linhas.map((l) => (
                      <Table.Tr key={l.linha}>
                        <Table.Td c="dimmed">{l.linha}</Table.Td>
                        <Table.Td fw={700}>{l.numeroNf}</Table.Td>
                        <Table.Td>
                          <Text fz="sm">{l.fornecedor}</Text>
                          <Text fz="xs" c="dimmed">
                            {l.valorTotal ? formatarMoeda(l.valorTotal) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>{l.tipo}</Table.Td>
                        <Table.Td>
                          <Text fz="sm">{l.responsavel || '—'}</Text>
                          <Text fz="xs" c="dimmed">
                            {l.setor || '—'} · {formatarDia(l.prazo)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {l.protocolo ? (
                            <Text fz="sm" fw={800} c="green.8" style={{ whiteSpace: 'nowrap' }}>
                              {l.protocolo}
                            </Text>
                          ) : (
                            <Badge color={SITUACAO[l.situacao].cor} variant="light">
                              {SITUACAO[l.situacao].rotulo}
                            </Badge>
                          )}
                          {l.erros.map((e) => (
                            <Text key={e} fz="xs" c={l.situacao === 'INVALIDA' ? 'itaxRed' : 'dimmed'}>
                              {e}
                            </Text>
                          ))}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Painel>
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <Stack gap="lg">
          <Painel titulo="3. Regras de distribuição">
            <Stack>
              <Text fz="sm" c="dimmed">
                Valem para as linhas que vierem sem setor, responsável, prazo ou prioridade.
              </Text>
              <Select
                label="Setor padrão do lote"
                clearable
                data={(cadastros?.setores ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
                value={setorId}
                onChange={(v) => {
                  setSetorId(v);
                  setResponsavelId(null);
                }}
              />
              <Select
                label="Responsável padrão"
                clearable
                searchable
                placeholder={setorId ? 'Selecione' : 'Escolha o setor primeiro'}
                data={responsaveis}
                value={responsavelId}
                onChange={setResponsavelId}
              />
              <SimpleGrid cols={2}>
                <DateInput
                  label="Prazo padrão"
                  placeholder="SLA do setor"
                  valueFormat="DD/MM/YYYY"
                  minDate={new Date()}
                  clearable
                  value={prazo}
                  onChange={setPrazo}
                />
                <Select
                  label="Prioridade padrão"
                  allowDeselect={false}
                  data={Object.entries(ROTULO_PRIORIDADE).map(([value, label]) => ({ value, label }))}
                  value={prioridade}
                  onChange={(v) => setPrioridade((v as Prioridade) ?? 'NORMAL')}
                />
              </SimpleGrid>
              <Alert color="gray" variant="light">
                Cada linha válida gera uma tratativa independente e conserva seu próprio histórico.
              </Alert>
              {erro && (
                <Alert color="itaxRed" icon={<IconAlertTriangle size={18} />}>
                  {erro}
                </Alert>
              )}
              {final ? (
                <Button leftSection={<IconListDetails size={16} />} onClick={() => navigate('/divergencias')}>
                  Ver na central de divergências
                </Button>
              ) : (
                <Button
                  leftSection={<IconCheck size={16} />}
                  disabled={!previa?.validas}
                  loading={ocupado}
                  onClick={confirmar}
                >
                  Confirmar cadastro e distribuição{previa?.validas ? ` (${previa.validas})` : ''}
                </Button>
              )}
            </Stack>
          </Painel>
          <Painel titulo="Resumo do lote">
            <SimpleGrid cols={2}>
              <Estatistica valor={relatorio?.totalLinhas ?? '—'} legenda="Linhas no arquivo" />
              <Estatistica
                valor={relatorio?.validas ?? '—'}
                legenda={final ? 'Tratativas criadas' : 'Prontas para importar'}
                cor="green.8"
              />
              <Estatistica valor={relatorio?.duplicadas ?? '—'} legenda="Duplicadas (ignoradas)" />
              <Estatistica
                valor={relatorio?.invalidas ?? '—'}
                legenda="Com erro"
                cor={relatorio?.invalidas ? 'itaxRed' : undefined}
              />
            </SimpleGrid>
          </Painel>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function RegistrarModal({
  notaIds,
  aberto,
  aoFechar,
  aoConcluir,
}: {
  notaIds: number[];
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const cadastros = useCadastros();
  const { temPerfil } = useAuth();
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>('NORMAL');
  const [prazo, setPrazo] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsaveis = useMemo(
    () =>
      opcoesResponsaveis(
        cadastros?.usuarios ?? [],
        setorId ? Number(setorId) : null,
        temPerfil('GESTOR', 'ADMIN'),
      ),
    [cadastros, setorId, temPerfil],
  );

  async function enviar() {
    setErro(null);
    if (!tipoId || !setorId || !responsavelId) return setErro('Escolha tipo, setor e responsável');
    if (descricao.trim().length < 10) return setErro('Descreva a divergência (mínimo 10 caracteres)');
    setOcupado(true);
    try {
      const criadas = await api.post<Divergencia[]>('/divergencias', {
        notaFiscalIds: notaIds,
        tipoId: Number(tipoId),
        setorId: Number(setorId),
        responsavelId: Number(responsavelId),
        prioridade,
        prazo: prazo ? dayjs(prazo).format('YYYY-MM-DD') : undefined,
        descricao,
      });
      notifications.show({
        color: 'green',
        message: `${criadas.length} divergência(s) cadastrada(s): ${criadas.map((c) => c.protocolo).join(', ')}`,
      });
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      opened={aberto}
      onClose={aoFechar}
      title={`Registrar divergência em ${notaIds.length} nota(s)`}
      size="lg"
      centered
    >
      <Stack>
        <Select
          label="Tipo de divergência"
          withAsterisk
          searchable
          data={(cadastros?.tipos ?? []).map((t) => ({ value: String(t.id), label: t.nome }))}
          value={tipoId}
          onChange={(v) => {
            setTipoId(v);
            const tipo = cadastros?.tipos.find((t) => String(t.id) === v);
            if (tipo?.setorOrigemId && !setorId) setSetorId(String(tipo.setorOrigemId));
          }}
        />
        <SimpleGrid cols={2}>
          <Select
            label="Setor responsável"
            withAsterisk
            data={(cadastros?.setores ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
            value={setorId}
            onChange={(v) => {
              setSetorId(v);
              setResponsavelId(null);
            }}
          />
          <Select
            label="Responsável"
            withAsterisk
            searchable
            data={responsaveis}
            value={responsavelId}
            onChange={setResponsavelId}
          />
          <Select
            label="Prioridade"
            allowDeselect={false}
            data={Object.entries(ROTULO_PRIORIDADE).map(([value, label]) => ({ value, label }))}
            value={prioridade}
            onChange={(v) => setPrioridade((v as Prioridade) ?? 'NORMAL')}
          />
          <DateInput
            label="Prazo"
            placeholder="SLA do setor"
            valueFormat="DD/MM/YYYY"
            minDate={new Date()}
            clearable
            value={prazo}
            onChange={setPrazo}
          />
        </SimpleGrid>
        <Textarea
          label="Descrição e providência solicitada"
          withAsterisk
          autosize
          minRows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.currentTarget.value)}
        />
        {erro && <Alert color="itaxRed">{erro}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button leftSection={<IconSend size={16} />} loading={ocupado} onClick={enviar}>
            Cadastrar e enviar para o setor
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ImportacaoXml() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoXml | null>(null);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [busca, setBusca] = useState('');
  const [buscaAtiva] = useDebouncedValue(busca, 300);
  const [pagina, setPagina] = useState(1);
  const [modal, { open, close }] = useDisclosure();
  const notas = useApi(
    () =>
      api.pagina<NotaFiscal>('/notas', { status: 'SEM_PENDENCIA', busca: buscaAtiva, pagina, porPagina: 20 }),
    [buscaAtiva, pagina, resultado],
  );

  async function enviar(arquivos: File[]) {
    setEnviando(true);
    setErro(null);
    const corpo = new FormData();
    arquivos.forEach((a) => corpo.append('arquivos', a));
    try {
      setResultado(await api.post<ResultadoImportacaoXml>('/notas/importar', corpo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Stack gap="lg">
      <Painel titulo="XMLs da NF-e">
        <Dropzone
          onDrop={enviar}
          loading={enviando}
          accept={{ 'application/xml': ['.xml'], 'text/xml': ['.xml'] }}
          maxSize={5 * 1024 * 1024}
          maxFiles={500}
          onReject={() => setErro('Envie apenas arquivos .xml de até 5 MB (máximo de 500 por vez).')}
        >
          <Stack align="center" gap={4} mih={110} justify="center" style={{ pointerEvents: 'none' }}>
            <IconUpload size={36} stroke={1.25} color="var(--mantine-color-gray-6)" />
            <Text fw={700}>Arraste os XMLs das NF-es aqui ou clique para escolher</Text>
            <Text fz="sm" c="dimmed">
              Até 500 arquivos por envio. Notas já cadastradas (mesma chave ou CNPJ + série + número) são
              ignoradas.
            </Text>
          </Stack>
        </Dropzone>
        {erro && (
          <Alert mt="md" color="itaxRed" icon={<IconAlertTriangle size={18} />}>
            {erro}
          </Alert>
        )}
        {resultado && (
          <Alert mt="md" color={resultado.erros.length ? 'yellow' : 'green'} title="Importação concluída">
            {resultado.importacao.totalImportadas} importada(s), {resultado.importacao.totalDuplicadas} já
            existiam, {resultado.importacao.totalInvalidas} com erro.
            {resultado.erros.length > 0 && (
              <List size="sm" mt={4}>
                {resultado.erros.map((e) => (
                  <List.Item key={e.arquivo}>
                    <b>{e.arquivo}</b>: {e.motivo}
                  </List.Item>
                ))}
              </List>
            )}
          </Alert>
        )}
      </Painel>
      <Card withBorder p={0}>
        <Group
          justify="space-between"
          p="md"
          gap="sm"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <div>
            <Text fw={800}>Notas sem divergência registrada</Text>
            <Text fz="xs" c="dimmed">
              Marque as que não deram certo e registre a divergência.
            </Text>
          </div>
          <Group gap="sm">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Número, chave, CNPJ ou emitente"
              value={busca}
              onChange={(e) => {
                setBusca(e.currentTarget.value);
                setPagina(1);
              }}
            />
            <Button leftSection={<IconSend size={16} />} disabled={selecionadas.length === 0} onClick={open}>
              Registrar divergência{selecionadas.length ? ` (${selecionadas.length})` : ''}
            </Button>
          </Group>
        </Group>
        {notas.carregando && !notas.dados && <Carregando />}
        {notas.dados?.data.length === 0 && <Vazio titulo="Nenhuma nota aguardando conferência" />}
        {notas.dados && notas.dados.data.length > 0 && (
          <TabelaNotas notas={notas.dados.data} selecionadas={selecionadas} aoSelecionar={setSelecionadas} />
        )}
        {notas.dados && notas.dados.meta.total > 20 && (
          <Group justify="flex-end" p="sm">
            <Pagination
              size="sm"
              value={pagina}
              onChange={setPagina}
              total={Math.ceil(notas.dados.meta.total / 20)}
            />
          </Group>
        )}
      </Card>
      <RegistrarModal
        key={selecionadas.join(',')}
        notaIds={selecionadas}
        aberto={modal}
        aoFechar={close}
        aoConcluir={() => {
          close();
          setSelecionadas([]);
          void notas.recarregar();
        }}
      />
    </Stack>
  );
}

export function Importar() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'csv' | 'xml'>('csv');
  return (
    <>
      <Cabecalho
        sobretitulo="Entrada em lote"
        titulo="Importação de notas fiscais"
        descricao="Importe um arquivo CSV ou os XMLs da NF-e; valide os campos e direcione as tratativas."
        acoes={
          <Button
            variant="default"
            leftSection={<IconListDetails size={16} />}
            onClick={() => navigate('/divergencias')}
          >
            Voltar para divergências
          </Button>
        }
      />
      <SegmentedControl
        mb="lg"
        value={modo}
        onChange={(v) => setModo(v as 'csv' | 'xml')}
        data={[
          { value: 'csv', label: 'Planilha CSV (uma linha por divergência)' },
          { value: 'xml', label: 'XML da NF-e' },
        ]}
      />
      {modo === 'csv' ? <ImportacaoCsv /> : <ImportacaoXml />}
    </>
  );
}
