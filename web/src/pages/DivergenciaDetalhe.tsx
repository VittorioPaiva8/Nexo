import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowBackUp,
  IconArrowForward,
  IconArrowLeft,
  IconCheck,
  IconFileAlert,
  IconMessage,
  IconTool,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { DivergenciaDetalhe as Detalhe, TipoMensagem } from '../api/tipos';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { opcoesResponsaveis, useResponsaveis } from '../components/EncaminharModal';
import { Carregando, ErroCarregar } from '../components/Estado';
import { BadgeDivergencia, corDoTempo, ROTULO_MENSAGEM } from '../components/rotulos';
import {
  formatarChave,
  formatarData,
  formatarDataHora,
  formatarDuracao,
  formatarMoeda,
} from '../utils/formato';

const ICONE_MENSAGEM: Record<TipoMensagem, typeof IconMessage> = {
  SOLICITACAO: IconFileAlert,
  JUSTIFICATIVA: IconMessage,
  CORRECAO: IconTool,
  REPASSE: IconArrowForward,
  DEVOLUCAO: IconArrowBackUp,
  ACEITE: IconCheck,
};

type Acao = 'responder' | 'repassar' | 'aceitar' | 'devolver';

function PainelAcao({ d, aoAtualizar }: { d: Detalhe; aoAtualizar: (d: Detalhe) => void }) {
  const { usuario } = useAuth();
  const usuarios = useResponsaveis();
  const ehResponsavel = d.responsavelAtual?.id === usuario?.id;
  const ehSolicitante = d.solicitante.id === usuario?.id || usuario?.perfil === 'ADMIN';

  const disponiveis: Acao[] = [];
  if (d.status === 'PENDENTE' && ehResponsavel) disponiveis.push('responder');
  if (d.status === 'PENDENTE' && (ehResponsavel || ehSolicitante)) disponiveis.push('repassar');
  if (d.status === 'AGUARDANDO_REVISAO' && ehSolicitante) disponiveis.push('aceitar', 'devolver');

  const [acao, setAcao] = useState<Acao | null>(disponiveis[0] ?? null);
  const [tipoResposta, setTipoResposta] = useState<'JUSTIFICATIVA' | 'CORRECAO'>('JUSTIFICATIVA');
  const [texto, setTexto] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo(
    () => opcoesResponsaveis(usuarios, acao === 'repassar' ? d.responsavelAtual?.id : undefined),
    [usuarios, acao, d.responsavelAtual?.id],
  );

  if (disponiveis.length === 0 || !acao) return null;

  const rotulos: Record<Acao, string> = {
    responder: 'Responder',
    repassar: 'Repassar',
    aceitar: 'Aceitar retorno',
    devolver: 'Devolver',
  };

  async function enviar() {
    setErro(null);
    if (acao !== 'aceitar' && texto.trim().length < 3) return setErro('Escreva uma mensagem');
    if (acao === 'repassar' && !responsavelId) return setErro('Escolha o novo responsável');
    const corpo =
      acao === 'responder'
        ? { tipo: tipoResposta, texto }
        : acao === 'repassar'
          ? { responsavelId: Number(responsavelId), texto }
          : acao === 'devolver'
            ? { texto, ...(responsavelId ? { responsavelId: Number(responsavelId) } : {}) }
            : { texto: texto || undefined };
    setEnviando(true);
    try {
      const atualizado = await api.post<Detalhe>(`/divergencias/${d.id}/${acao}`, corpo);
      notifications.show({ color: 'green', message: 'Feito! O histórico foi atualizado.' });
      setTexto('');
      setResponsavelId(null);
      aoAtualizar(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <Stack>
        <Title order={4}>O que fazer agora</Title>
        {disponiveis.length > 1 && (
          <SegmentedControl
            value={acao}
            onChange={(v) => setAcao(v as Acao)}
            data={disponiveis.map((a) => ({ value: a, label: rotulos[a] }))}
          />
        )}
        {acao === 'responder' && (
          <SegmentedControl
            value={tipoResposta}
            onChange={(v) => setTipoResposta(v as typeof tipoResposta)}
            color="dark"
            data={[
              { value: 'JUSTIFICATIVA', label: 'Justificar' },
              { value: 'CORRECAO', label: 'Informar correção' },
            ]}
          />
        )}
        {(acao === 'repassar' || acao === 'devolver') && (
          <Select
            label={acao === 'repassar' ? 'Novo responsável' : 'Devolver para (opcional)'}
            placeholder={
              acao === 'devolver'
                ? `Mesmo responsável (${d.responsavelAtual?.nome ?? '—'})`
                : 'Busque pelo nome'
            }
            data={opcoes}
            searchable
            clearable={acao === 'devolver'}
            value={responsavelId}
            onChange={setResponsavelId}
          />
        )}
        <Textarea
          label={
            acao === 'aceitar'
              ? 'Mensagem (opcional)'
              : acao === 'responder'
                ? tipoResposta === 'JUSTIFICATIVA'
                  ? 'Justificativa'
                  : 'O que foi corrigido'
                : 'Mensagem'
          }
          placeholder={
            acao === 'responder'
              ? 'Ex.: nota cancelada e reemitida com o valor correto (NF 1240).'
              : acao === 'devolver'
                ? 'Explique por que o retorno não resolve.'
                : ''
          }
          autosize
          minRows={3}
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
        />
        {erro && <Alert color="itaxRed">{erro}</Alert>}
        <Group justify="flex-end">
          <Button
            onClick={enviar}
            loading={enviando}
            color={acao === 'aceitar' ? 'green' : 'itaxRed'}
            leftSection={acao === 'aceitar' ? <IconCheck size={16} /> : undefined}
          >
            {acao === 'responder' ? 'Enviar ao solicitante' : rotulos[acao]}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function DivergenciaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    dados: d,
    carregando,
    erro,
    setDados,
  } = useApi(() => api.get<Detalhe>(`/divergencias/${id}`), [id]);

  if (carregando) return <Carregando />;
  if (erro || !d) return <ErroCarregar mensagem={erro ?? 'Divergência não encontrada'} />;

  const totalPorPessoa = d.atribuicoes.reduce((acc, a) => acc + a.horas, 0);

  return (
    <Stack>
      <div>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          Voltar
        </Button>
      </div>

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={2}>NF {d.notaFiscal.numero}</Title>
            <BadgeDivergencia status={d.status} />
          </Group>
          <Text c="dimmed" fz="sm">
            {d.notaFiscal.emitenteNome} · {formatarMoeda(d.notaFiscal.valorTotal)}
            {d.notaFiscal.dataEmissao ? ` · emitida em ${formatarData(d.notaFiscal.dataEmissao)}` : ''}
          </Text>
          <Text c="dimmed" fz="xs" ff="monospace">
            {formatarChave(d.notaFiscal.chaveAcesso)}
          </Text>
        </Stack>
        <Stack gap={2} align="flex-end">
          <Text fz="xs" c="dimmed">
            Aberta há
          </Text>
          <Badge
            size="lg"
            variant="outline"
            color={d.status === 'RESOLVIDA' ? 'gray' : corDoTempo(d.horasAberta)}
          >
            {formatarDuracao(d.horasAberta)}
          </Badge>
        </Stack>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Card>
              <Text fz="xs" c="dimmed">
                {d.tipo.nome} · solicitado por {d.solicitante.nome}
              </Text>
              <Text mt={4}>{d.descricao}</Text>
            </Card>
            <PainelAcao key={`${d.status}-${d.responsavelAtual?.id}`} d={d} aoAtualizar={setDados} />
            <Card>
              <Title order={4} mb="md">
                Histórico
              </Title>
              <Timeline active={d.mensagens.length} bulletSize={28} lineWidth={2}>
                {d.mensagens.map((m) => {
                  const Icone = ICONE_MENSAGEM[m.tipo];
                  return (
                    <Timeline.Item
                      key={m.id}
                      bullet={
                        <ThemeIcon size={28} radius="xl" color={m.tipo === 'ACEITE' ? 'green' : 'dark'}>
                          <Icone size={14} stroke={1.5} />
                        </ThemeIcon>
                      }
                      title={
                        <Text fw={600} fz="sm">
                          {m.autor.nome} · {ROTULO_MENSAGEM[m.tipo].toLowerCase()}
                        </Text>
                      }
                    >
                      <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {m.texto}
                      </Text>
                      <Text fz="xs" c="dimmed" mt={2}>
                        {formatarDataHora(m.criadaEm)}
                      </Text>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card>
            <Title order={4}>Tempo com cada responsável</Title>
            <Text fz="xs" c="dimmed" mb="sm">
              Horas corridas desde o encaminhamento até a resposta ou o repasse.
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Responsável</Table.Th>
                  <Table.Th>Período</Table.Th>
                  <Table.Th ta="right">Tempo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.atribuicoes.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Text fz="sm">{a.responsavel.nome}</Text>
                      <Text fz="xs" c="dimmed">
                        {a.setor?.nome ?? 'Sem setor'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="xs">{formatarDataHora(a.inicio)}</Text>
                      <Text fz="xs" c="dimmed">
                        {a.fim ? `até ${formatarDataHora(a.fim)}` : 'em andamento'}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Badge
                        variant={a.fim ? 'light' : 'outline'}
                        color={a.fim ? 'gray' : corDoTempo(a.horas)}
                      >
                        {formatarDuracao(a.horas)}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Text fz="sm" mt="sm" ta="right">
              Total com responsáveis: <b>{formatarDuracao(totalPorPessoa)}</b>
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
