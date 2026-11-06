import { BarChart } from '@mantine/charts';
import { Card, Grid, Group, Select, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api } from '../api/cliente';
import type { LinhaTempo, Metricas, Setor, TipoDivergencia } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Carregando, ErroCarregar, Vazio } from '../components/Estado';
import { Titulo } from '../components/Titulo';
import { formatarDuracao, formatarNumero } from '../utils/formato';

// Série única: um tom neutro escuro. O vermelho fica reservado para ações e alertas (manual ITAX, seção 6).
const COR_SERIE = 'dark.4';

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <Card>
      <Text fz="sm" c="dimmed">
        {rotulo}
      </Text>
      <Text fz={28} fw={700} style={{ letterSpacing: -1 }}>
        {valor}
      </Text>
      {detalhe && (
        <Text fz="xs" c="dimmed">
          {detalhe}
        </Text>
      )}
    </Card>
  );
}

function TabelaTempo({ linhas, rotulo }: { linhas: LinhaTempo[]; rotulo: string }) {
  return (
    <Table.ScrollContainer minWidth={460}>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{rotulo}</Table.Th>
            <Table.Th ta="right">Tempo total</Table.Th>
            <Table.Th ta="right">Média por nota</Table.Th>
            <Table.Th ta="right">Notas recebidas</Table.Th>
            <Table.Th ta="right">Pendentes agora</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {linhas.map((l) => (
            <Table.Tr key={`${l.id}-${l.nome}`}>
              <Table.Td fw={600}>{l.nome}</Table.Td>
              <Table.Td ta="right">{formatarDuracao(l.horasTotais)}</Table.Td>
              <Table.Td ta="right">{formatarDuracao(l.horasMedias)}</Table.Td>
              <Table.Td ta="right">{l.passagens}</Table.Td>
              <Table.Td ta="right" fw={l.pendentesAgora ? 700 : undefined}>
                {l.pendentesAgora}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function Painel() {
  const [periodo, setPeriodo] = useState<DatesRangeValue<string>>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState<string | null>(null);

  const setores = useApi(() => api.get<Setor[]>('/setores'), []);
  const tipos = useApi(() => api.get<TipoDivergencia[]>('/tipos-divergencia'), []);
  const [inicio, fim] = periodo;
  const {
    dados: m,
    carregando,
    erro,
  } = useApi(
    () => api.get<Metricas>('/metricas', { inicio, fim, setorId, tipoId }),
    [inicio, fim, setorId, tipoId],
  );

  return (
    <Stack>
      <Titulo titulo="Painel" descricao="Onde as notas param e quanto tempo ficam abertas sem ajuste." />

      <Group gap="sm" wrap="wrap">
        <DatePickerInput
          type="range"
          label="Abertas no período"
          valueFormat="DD/MM/YYYY"
          locale="pt-br"
          leftSection={<IconCalendar size={16} />}
          value={periodo}
          onChange={setPeriodo}
          allowSingleDateInRange
          clearable
          miw={260}
        />
        <Select
          label="Setor"
          placeholder="Todos"
          clearable
          data={(setores.dados ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
          value={setorId}
          onChange={setSetorId}
        />
        <Select
          label="Tipo de divergência"
          placeholder="Todos"
          clearable
          data={(tipos.dados ?? []).map((t) => ({ value: String(t.id), label: t.nome }))}
          value={tipoId}
          onChange={setTipoId}
        />
      </Group>

      {carregando && <Carregando />}
      {erro && <ErroCarregar mensagem={erro} />}
      {m && !carregando && m.resumo.total === 0 && (
        <Vazio titulo="Nenhuma divergência no período">
          Ajuste o filtro ou encaminhe notas para começar.
        </Vazio>
      )}

      {m && !carregando && m.resumo.total > 0 && (
        <>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <Indicador
              rotulo="Abertas agora"
              valor={String(m.resumo.abertas)}
              detalhe={`${m.resumo.pendentesComResponsavel} com responsável · ${m.resumo.aguardandoRevisao} para revisar`}
            />
            <Indicador
              rotulo="Tempo médio de nota aberta"
              valor={formatarDuracao(m.resumo.horasMediasAbertas)}
              detalhe="Das que ainda não foram ajustadas"
            />
            <Indicador
              rotulo="Tempo médio até resolver"
              valor={formatarDuracao(m.resumo.horasMediasResolucao)}
              detalhe={`${m.resumo.resolvidas} resolvida(s) de ${m.resumo.total}`}
            />
            <Indicador
              rotulo="Reabertura"
              valor={`${formatarNumero(m.resumo.taxaReabertura)}%`}
              detalhe="Devolvidas ao menos uma vez"
            />
          </SimpleGrid>

          <Card>
            <Title order={4}>Setores que mais seguram notas</Title>
            <Text fz="xs" c="dimmed" mb="md">
              Soma das horas corridas que as notas ficaram com cada setor.
            </Text>
            <BarChart
              h={Math.max(160, m.porSetor.length * 44)}
              data={m.porSetor.map((s) => ({ setor: s.nome, horas: s.horasTotais }))}
              dataKey="setor"
              orientation="vertical"
              series={[{ name: 'horas', label: 'Horas', color: COR_SERIE }]}
              valueFormatter={(v) => formatarDuracao(v)}
              gridAxis="none"
              withXAxis={false}
              yAxisProps={{ width: 110 }}
              barProps={{ radius: 4, maxBarSize: 28 }}
              withBarValueLabel
            />
            <TabelaTempo linhas={m.porSetor} rotulo="Setor" />
          </Card>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card h="100%">
                <Title order={4}>Idade das notas abertas</Title>
                <Text fz="xs" c="dimmed" mb="md">
                  Quantas pendências estão abertas há quanto tempo.
                </Text>
                <BarChart
                  h={220}
                  data={m.faixasIdade}
                  dataKey="faixa"
                  series={[{ name: 'quantidade', label: 'Notas', color: COR_SERIE }]}
                  gridAxis="y"
                  yAxisProps={{ allowDecimals: false, width: 32 }}
                  barProps={{ radius: 4, maxBarSize: 28 }}
                  withBarValueLabel
                />
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card h="100%">
                <Title order={4}>Divergências mais comuns</Title>
                <Text fz="xs" c="dimmed" mb="md">
                  Quantidade por tipo no período.
                </Text>
                <BarChart
                  h={Math.max(160, m.porTipo.length * 40)}
                  data={m.porTipo}
                  dataKey="tipo"
                  orientation="vertical"
                  series={[{ name: 'quantidade', label: 'Divergências', color: COR_SERIE }]}
                  gridAxis="none"
                  withXAxis={false}
                  yAxisProps={{ width: 170 }}
                  barProps={{ radius: 4, maxBarSize: 28 }}
                  withBarValueLabel
                />
              </Card>
            </Grid.Col>
          </Grid>

          <Card>
            <Title order={4} mb="sm">
              Tempo por responsável
            </Title>
            <TabelaTempo linhas={m.porResponsavel} rotulo="Responsável" />
          </Card>
        </>
      )}
    </Stack>
  );
}
