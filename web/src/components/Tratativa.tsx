import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowBackUp,
  IconArrowForward,
  IconCheck,
  IconDeviceFloppy,
  IconFileAlert,
  IconPaperclip,
  IconPlayerPlay,
  IconRotate,
  IconSend,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { opcoesResponsaveis, useCadastros } from '../api/cadastros';
import { api } from '../api/cliente';
import type { AcaoMovimentacao, DivergenciaDetalhe } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import {
  formatarChave,
  formatarCnpj,
  formatarData,
  formatarDataHora,
  formatarDia,
  formatarDuracao,
  formatarMoeda,
  formatarTamanho,
} from '../utils/formato';
import { BadgeDivergencia, corDoTempo, ROTULO_ACAO, ROTULO_PRIORIDADE, TIPOS_SOLUCAO } from './rotulos';
import { Campo, Destaque, TituloSecao } from './ui';

type Atualizar = (d: DivergenciaDetalhe) => void;

const ICONE: Record<AcaoMovimentacao, typeof IconCheck> = {
  CADASTRO: IconFileAlert,
  ASSUNCAO: IconPlayerPlay,
  DEVOLUCAO: IconArrowBackUp,
  CONCLUSAO: IconCheck,
  REABERTURA: IconRotate,
  REDISTRIBUICAO: IconArrowForward,
};

const COR: Record<AcaoMovimentacao, string> = {
  CADASTRO: 'gray',
  ASSUNCAO: 'blue',
  DEVOLUCAO: 'violet',
  CONCLUSAO: 'green',
  REABERTURA: 'itaxRed',
  REDISTRIBUICAO: 'dark',
};

function erroDe(e: unknown) {
  return e instanceof Error ? e.message : 'Não foi possível salvar';
}

export function baixarAnexo(id: number, nome: string) {
  api
    .baixar(`/divergencias/anexos/${id}`, nome)
    .catch((e) => notifications.show({ color: 'itaxRed', message: erroDe(e) }));
}

/** Dados da nota e do que o Fiscal pediu. */
export function ResumoTratativa({ d }: { d: DivergenciaDetalhe }) {
  const n = d.notaFiscal;
  const linhaNota = [
    n.dataEmissao ? `Emissão: ${formatarData(n.dataEmissao)}` : null,
    n.pedidoCompra ? `Pedido: ${n.pedidoCompra}` : null,
    formatarMoeda(n.valorTotal),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="xs">
        <div style={{ minWidth: 0 }}>
          <Text fz={11} fw={800} c="itaxRed" style={{ letterSpacing: 1.6 }}>
            PROTOCOLO {d.protocolo}
          </Text>
          <Text fw={800} fz="lg">
            NF {n.numero} · {n.emitenteNome}
          </Text>
          <Text fz="sm" c="dimmed">
            {linhaNota}
          </Text>
          <Text fz="xs" c="dimmed">
            CNPJ {formatarCnpj(n.emitenteCnpj)}
            {n.chaveAcesso ? ` · chave ${formatarChave(n.chaveAcesso)}` : ''}
          </Text>
        </div>
        <BadgeDivergencia status={d.status} atrasada={d.atrasada} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
        <Campo rotulo="Tipo de divergência">{d.tipo.nome}</Campo>
        <Campo rotulo="Setor">{d.setor.nome}</Campo>
        <Campo rotulo="Responsável">{d.responsavelAtual?.nome ?? '—'}</Campo>
        <Campo rotulo="Prazo">
          <Text span c={d.atrasada ? 'itaxRed' : undefined} fw={700} fz="sm">
            {formatarDia(d.prazo)}
          </Text>
          {d.prazoOriginal.slice(0, 10) !== d.prazo.slice(0, 10) && (
            <Text span fz="xs" c="dimmed">
              {' '}
              (original {formatarDia(d.prazoOriginal)})
            </Text>
          )}
        </Campo>
        <Campo rotulo="Prioridade">{ROTULO_PRIORIDADE[d.prioridade]}</Campo>
        <Campo rotulo="Solicitado por">{d.solicitante.nome}</Campo>
      </SimpleGrid>
      <div>
        <TituloSecao>O que o Fiscal solicitou?</TituloSecao>
        <Destaque>{d.descricao}</Destaque>
      </div>
      {(d.valorNf || d.valorEsperado || d.correcaoEsperada) && (
        <div>
          <TituloSecao>Conferência da divergência</TituloSecao>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Paper withBorder p="sm" radius="md">
              <Text fz={11} fw={800} c="dimmed">
                NA NOTA FISCAL
              </Text>
              <Text fw={800} fz="lg">
                {d.valorNf ?? '—'}
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md">
              <Text fz={11} fw={800} c="dimmed">
                ESPERADO
              </Text>
              <Text fw={800} fz="lg" c="green.8">
                {d.valorEsperado ?? '—'}
              </Text>
            </Paper>
          </SimpleGrid>
          {d.correcaoEsperada && (
            <Text fz="sm" mt="xs">
              <b>Correção esperada:</b> {d.correcaoEsperada}
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
}

/** Histórico de movimentações, do mais recente para o mais antigo. */
export function Historico({ d }: { d: DivergenciaDetalhe }) {
  const movs = d.movimentacoes.toReversed();
  return (
    <Timeline active={movs.length} bulletSize={26} lineWidth={2} color="gray">
      {movs.map((m) => {
        const Icone = ICONE[m.acao];
        return (
          <Timeline.Item
            key={m.id}
            bullet={
              <ThemeIcon size={26} radius="xl" color={COR[m.acao]}>
                <Icone size={14} stroke={1.8} />
              </ThemeIcon>
            }
            title={
              <Text fw={700} fz="sm">
                {ROTULO_ACAO[m.acao]}
                {m.destino && m.acao !== 'DEVOLUCAO' ? ` · ${m.destino.nome}` : ''}
                {m.setorDestino && m.acao === 'REDISTRIBUICAO' ? ` (${m.setorDestino})` : ''}
              </Text>
            }
          >
            <Text fz="xs" c="dimmed">
              {formatarDataHora(m.criadaEm)} · {m.autor.nome}
            </Text>
            <Text fz="sm" mt={2} style={{ whiteSpace: 'pre-wrap' }}>
              {m.texto}
            </Text>
            {m.prazoNovo && m.prazoAnterior && (
              <Text fz="xs" c="dimmed">
                Prazo alterado de {formatarDia(m.prazoAnterior)} para {formatarDia(m.prazoNovo)}
              </Text>
            )}
            {m.anexos.map((a) => (
              <Anchor key={a.id} fz="xs" display="block" onClick={() => baixarAnexo(a.id, a.nomeArquivo)}>
                <IconPaperclip size={12} /> {a.nomeArquivo}
              </Anchor>
            ))}
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}

export function ListaAnexos({ d }: { d: DivergenciaDetalhe }) {
  if (d.anexos.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        Nenhum anexo.
      </Text>
    );
  }
  return (
    <Stack gap={6}>
      {d.anexos.map((a) => (
        <Group key={a.id} justify="space-between" wrap="nowrap" gap="xs">
          <Anchor fz="sm" onClick={() => baixarAnexo(a.id, a.nomeArquivo)} truncate>
            <IconPaperclip size={14} /> {a.nomeArquivo}
          </Anchor>
          <Group gap={6} wrap="nowrap">
            <Badge size="xs" variant="light" color={a.categoria === 'EVIDENCIA' ? 'violet' : 'gray'}>
              {a.categoria === 'EVIDENCIA' ? 'Evidência' : 'Apoio'}
            </Badge>
            <Text fz="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {formatarTamanho(a.tamanho)} · {a.usuario.nome}
            </Text>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

export function TempoResponsaveis({ d }: { d: DivergenciaDetalhe }) {
  const total = d.atribuicoes.reduce((s, a) => s + a.horas, 0);
  return (
    <>
      <Table.ScrollContainer minWidth={360}>
        <Table verticalSpacing={6} fz="sm">
          <Table.Tbody>
            {d.atribuicoes.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Text fz="sm">{a.responsavel.nome}</Text>
                  <Text fz="xs" c="dimmed">
                    {a.setor?.nome ?? 'Sem setor'} · {formatarDataHora(a.inicio)}
                    {a.fim ? '' : ' · em andamento'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Badge variant={a.fim ? 'light' : 'outline'} color={a.fim ? 'gray' : corDoTempo(a.horas)}>
                    {formatarDuracao(a.horas)}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text fz="sm" ta="right" mt="xs">
        Total com os setores: <b>{formatarDuracao(total)}</b>
      </Text>
    </>
  );
}

/** Área do responsável: assumir, devolutiva obrigatória, tipo de solução, evidência e rascunho. */
export function PainelResposta({ d, aoAtualizar }: { d: DivergenciaDetalhe; aoAtualizar: Atualizar }) {
  const [texto, setTexto] = useState(d.rascunho ?? '');
  const [tipoSolucao, setTipoSolucao] = useState<string | null>(d.tipoSolucao);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: string, fn: () => Promise<DivergenciaDetalhe>, mensagem: string) {
    setErro(null);
    setOcupado(acao);
    try {
      aoAtualizar(await fn());
      notifications.show({ color: 'green', message: mensagem });
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setOcupado(null);
    }
  }

  const devolver = () => {
    if (texto.trim().length < 10)
      return setErro('Descreva a correção realizada antes de devolver (mínimo 10 caracteres).');
    const corpo = new FormData();
    corpo.append('texto', texto);
    if (tipoSolucao) corpo.append('tipoSolucao', tipoSolucao);
    for (const a of arquivos) corpo.append('arquivos', a);
    return executar(
      'devolver',
      () => api.post<DivergenciaDetalhe>(`/divergencias/${d.id}/devolver`, corpo),
      'Devolução registrada; o Fiscal vai validar a correção.',
    );
  };

  return (
    <Stack gap="md">
      {d.status === 'PENDENTE' && (
        <Alert color="orange" title="Solicitação nova">
          <Group justify="space-between" gap="sm">
            <Text fz="sm">Assuma a tratativa para o Fiscal saber que você já está cuidando dela.</Text>
            <Button
              size="xs"
              color="blue"
              leftSection={<IconPlayerPlay size={14} />}
              loading={ocupado === 'assumir'}
              onClick={() =>
                executar(
                  'assumir',
                  () => api.post<DivergenciaDetalhe>(`/divergencias/${d.id}/assumir`),
                  'Tratativa assumida.',
                )
              }
            >
              Assumir tratativa
            </Button>
          </Group>
        </Alert>
      )}
      {d.reaberturas > 0 && d.status !== 'PENDENTE' && (
        <Alert color="itaxRed" title="Reaberta pelo Fiscal">
          {d.movimentacoes.findLast((m) => m.acao === 'REABERTURA')?.texto}
        </Alert>
      )}
      <Textarea
        label="Ação executada / devolutiva"
        withAsterisk
        autosize
        minRows={4}
        placeholder="Ex.: Pedido de compra ajustado de 10 para 12 unidades conforme NF. Alteração conferida com o comprador e liberada para relançamento."
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="Tipo de solução"
          placeholder="Selecione"
          data={TIPOS_SOLUCAO}
          clearable
          value={tipoSolucao}
          onChange={setTipoSolucao}
        />
        <FileInput
          label="Evidência / documento"
          placeholder="PDF, XML ou imagem"
          multiple
          clearable
          accept=".pdf,.xml,.png,.jpg,.jpeg"
          leftSection={<IconPaperclip size={16} />}
          value={arquivos}
          onChange={setArquivos}
        />
      </SimpleGrid>
      {erro && <Alert color="itaxRed">{erro}</Alert>}
      <Group justify="flex-end">
        <Button
          variant="default"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={ocupado === 'rascunho'}
          onClick={() =>
            executar(
              'rascunho',
              () =>
                api.put<DivergenciaDetalhe>(`/divergencias/${d.id}/rascunho`, {
                  texto,
                  tipoSolucao: tipoSolucao ?? undefined,
                }),
              'Rascunho salvo. A tratativa continua com você.',
            )
          }
        >
          Salvar rascunho
        </Button>
        <Button leftSection={<IconCheck size={16} />} loading={ocupado === 'devolver'} onClick={devolver}>
          Devolver ao Fiscal
        </Button>
      </Group>
    </Stack>
  );
}

/** Validação do Fiscal: devolutiva do setor, parecer, concluir ou reabrir (motivo obrigatório). */
export function PainelValidacao({ d, aoAtualizar }: { d: DivergenciaDetalhe; aoAtualizar: Atualizar }) {
  const cadastros = useCadastros();
  const [parecer, setParecer] = useState('');
  const [reabrindo, setReabrindo] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prazo, setPrazo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = useMemo(
    () => opcoesResponsaveis(cadastros?.usuarios ?? [], d.setor.id, false, d.responsavelAtual?.id),
    [cadastros, d],
  );

  async function enviar(acao: 'concluir' | 'reabrir') {
    setErro(null);
    if (acao === 'concluir' && parecer.trim().length < 3) return setErro('Registre o parecer do Fiscal.');
    if (acao === 'reabrir' && parecer.trim().length < 5)
      return setErro('Informe o motivo da reabertura no parecer.');
    setOcupado(acao);
    try {
      const corpo =
        acao === 'concluir'
          ? { parecer }
          : {
              motivo: parecer,
              ...(responsavelId ? { responsavelId: Number(responsavelId) } : {}),
              ...(prazo ? { prazo: dayjs(prazo).format('YYYY-MM-DD') } : {}),
            };
      aoAtualizar(await api.post<DivergenciaDetalhe>(`/divergencias/${d.id}/${acao}`, corpo));
      notifications.show({
        color: 'green',
        message:
          acao === 'concluir'
            ? 'Tratativa concluída mediante validação fiscal.'
            : 'Tratativa reaberta e devolvida ao responsável.',
      });
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setOcupado(null);
    }
  }

  const ultimaDevolucao = d.movimentacoes.findLast((m) => m.acao === 'DEVOLUCAO');
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <Campo rotulo="Devolvida por">{ultimaDevolucao?.autor.nome ?? '—'}</Campo>
        <Campo rotulo="Data de devolução">{formatarDataHora(d.devolvidaEm)}</Campo>
        <Campo rotulo="Tipo de solução">{d.tipoSolucao ?? '—'}</Campo>
      </SimpleGrid>
      <div>
        <TituloSecao>Devolutiva registrada pelo setor</TituloSecao>
        <Destaque cor="violet">{d.devolutiva}</Destaque>
        {ultimaDevolucao && ultimaDevolucao.anexos.length > 0 && (
          <Group gap="sm" mt={6}>
            {ultimaDevolucao.anexos.map((a) => (
              <Anchor key={a.id} fz="sm" onClick={() => baixarAnexo(a.id, a.nomeArquivo)}>
                <IconPaperclip size={14} /> {a.nomeArquivo}
              </Anchor>
            ))}
          </Group>
        )}
      </div>
      <Textarea
        label="Parecer do Fiscal"
        withAsterisk
        autosize
        minRows={3}
        placeholder="Anote a conferência realizada, inclusive em caso de reabertura."
        value={parecer}
        onChange={(e) => setParecer(e.currentTarget.value)}
      />
      {reabrindo && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Devolver para (opcional)"
            placeholder={`Mesmo responsável (${d.responsavelAtual?.nome ?? '—'})`}
            data={opcoes}
            clearable
            searchable
            value={responsavelId}
            onChange={setResponsavelId}
          />
          <DateInput
            label="Novo prazo (opcional)"
            description={`Atual: ${formatarDia(d.prazo)}; o anterior fica no histórico`}
            valueFormat="DD/MM/YYYY"
            minDate={new Date()}
            clearable
            value={prazo}
            onChange={setPrazo}
          />
        </SimpleGrid>
      )}
      {erro && <Alert color="itaxRed">{erro}</Alert>}
      <Group justify="flex-end">
        {reabrindo ? (
          <>
            <Button variant="subtle" color="gray" onClick={() => setReabrindo(false)}>
              Cancelar
            </Button>
            <Button
              color="itaxRed"
              variant="outline"
              leftSection={<IconRotate size={16} />}
              loading={ocupado === 'reabrir'}
              onClick={() => enviar('reabrir')}
            >
              Confirmar reabertura
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              leftSection={<IconArrowBackUp size={16} />}
              onClick={() => setReabrindo(true)}
            >
              Reabrir tratativa
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              loading={ocupado === 'concluir'}
              onClick={() => enviar('concluir')}
            >
              Validar e concluir
            </Button>
          </>
        )}
      </Group>
    </Stack>
  );
}

/** Redistribuir para outro responsável ou setor (Fiscal, gestor ou admin). */
export function BotaoRedistribuir({ d, aoAtualizar }: { d: DivergenciaDetalhe; aoAtualizar: Atualizar }) {
  const [aberto, { open, close }] = useDisclosure(false);
  const cadastros = useCadastros();
  const { temPerfil } = useAuth();
  const gestao = temPerfil('GESTOR', 'ADMIN');
  const [setorId, setSetorId] = useState<string | null>(String(d.setor.id));
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prazo, setPrazo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = useMemo(
    () =>
      opcoesResponsaveis(
        cadastros?.usuarios ?? [],
        setorId ? Number(setorId) : null,
        gestao,
        String(d.setor.id) === setorId ? d.responsavelAtual?.id : undefined,
      ),
    [cadastros, setorId, gestao, d],
  );

  async function enviar() {
    setErro(null);
    if (!responsavelId) return setErro('Escolha o novo responsável');
    if (motivo.trim().length < 5) return setErro('Explique o motivo da redistribuição');
    setOcupado(true);
    try {
      aoAtualizar(
        await api.post<DivergenciaDetalhe>(`/divergencias/${d.id}/redistribuir`, {
          setorId: Number(setorId),
          responsavelId: Number(responsavelId),
          motivo,
          ...(prazo ? { prazo: dayjs(prazo).format('YYYY-MM-DD') } : {}),
        }),
      );
      notifications.show({ color: 'green', message: 'Divergência redistribuída.' });
      close();
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Button variant="default" leftSection={<IconArrowForward size={16} />} onClick={open}>
        Redistribuir
      </Button>
      <Modal opened={aberto} onClose={close} title="Redistribuir divergência" centered>
        <Stack>
          <Select
            label="Setor"
            data={(cadastros?.setores ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
            value={setorId}
            allowDeselect={false}
            onChange={(v) => {
              setSetorId(v);
              setResponsavelId(null);
            }}
          />
          <Select
            label="Novo responsável"
            withAsterisk
            searchable
            data={opcoes}
            value={responsavelId}
            onChange={setResponsavelId}
          />
          <DateInput
            label="Novo prazo (opcional)"
            valueFormat="DD/MM/YYYY"
            minDate={new Date()}
            clearable
            value={prazo}
            onChange={setPrazo}
          />
          <Textarea
            label="Motivo"
            withAsterisk
            autosize
            minRows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
          {erro && <Alert color="itaxRed">{erro}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button leftSection={<IconSend size={16} />} loading={ocupado} onClick={enviar}>
              Redistribuir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

/** Regra lembrada na validação (manual, seção 8). */
export function RegraControle() {
  return (
    <Card withBorder>
      <Alert color="gray" variant="light" title="Concluir não é automático.">
        Somente o Fiscal ou um perfil validador pode encerrar após avaliar a correção e registrar a decisão.
      </Alert>
    </Card>
  );
}
