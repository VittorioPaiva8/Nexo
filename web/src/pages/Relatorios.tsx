import { BarChart } from '@mantine/charts';
import { Button, Grid, Group, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import { IconCalendar, IconDownload } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useCadastros } from '../api/cadastros';
import { api } from '../api/cliente';
import type { LinhaTempo, Relatorio } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Carregando, ErroCarregar, Vazio } from '../components/Estado';
import { BarraHorizontal, Cabecalho, Kpi, Painel } from '../components/ui';
import { formatarCnpj, formatarDuracao, formatarNumero, formatarPercentual } from '../utils/formato';

const META_SLA = 95;

function TabelaTempo({ linhas, rotulo }: { linhas: LinhaTempo[]; rotulo: string }) {
  if (linhas.length === 0) return <Vazio titulo="Sem passagens no período" />;
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{rotulo}</Table.Th>
            <Table.Th ta="right">Tempo total</Table.Th>
            <Table.Th ta="right">Média por passagem</Table.Th>
            <Table.Th ta="right">Passagens</Table.Th>
            <Table.Th ta="right">Com ele agora</Table.Th>
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

function exportar(r: Relatorio, periodo: string) {
  const linhas = [
    ['Indicador', 'Valor'],
    ['Período', periodo],
    ['Notas com divergência', r.resumo.total],
    ['Taxa de solução no SLA (%)', r.resumo.taxaSla ?? ''],
    ['Tempo médio de resolução (dias)', r.resumo.diasMediosResolucao],
    ['Reabertas (%)', r.resumo.taxaReabertura ?? ''],
    [],
    ['Setor', 'Ocorrências', 'Abertas', 'Vencidas', 'SLA (%)', 'Horas com o setor'],
    ...r.porSetor.map((s) => [s.nome, s.total, s.abertas, s.atrasadas, s.taxaSla ?? '', s.horasTotais]),
    [],
    ['Motivo', 'Ocorrências'],
    ...r.porTipo.map((t) => [t.tipo, t.quantidade]),
    [],
    ['Fornecedor', 'CNPJ', 'Ocorrências', 'Principal motivo'],
    ...r.porFornecedor.map((f) => [f.nome, formatarCnpj(f.cnpj), f.quantidade, f.principalMotivo]),
  ];
  const csv = linhas.map((l) => l.map((v) => String(v).replace(/;/g, ',')).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  a.download = `Relatorio_Fluxo_Fiscal_${dayjs().format('YYYY-MM-DD')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Relatorios() {
  const cadastros = useCadastros();
  const [periodo, setPeriodo] = useState<DatesRangeValue<string>>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [inicio, fim] = periodo;

  const {
    dados: r,
    carregando,
    erro,
  } = useApi(
    () =>
      api.get<Relatorio>('/metricas', {
        inicio: inicio ? dayjs(inicio).format('YYYY-MM-DD') : undefined,
        fim: fim ? dayjs(fim).format('YYYY-MM-DD') : undefined,
        setorId,
        tipoId,
      }),
    [inicio, fim, setorId, tipoId],
  );
  const textoPeriodo = inicio
    ? `${dayjs(inicio).format('DD/MM/YYYY')} a ${dayjs(fim ?? undefined).format('DD/MM/YYYY')}`
    : 'Todo o período';
  const maiorMotivo = Math.max(1, ...(r?.porTipo.map((t) => t.quantidade) ?? [1]));
  const maiorIdade = Math.max(1, ...(r?.faixasIdade.map((f) => f.quantidade) ?? [1]));

  return (
    <>
      <Cabecalho
        sobretitulo="Indicadores de gestão"
        titulo="Relatórios e acompanhamento de SLA"
        descricao="Indicadores por setor, responsável, motivo e tempo de resolução."
        acoes={
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            disabled={!r}
            onClick={() => r && exportar(r, textoPeriodo)}
          >
            Exportar visão (CSV)
          </Button>
        }
      />
      <Group mb="lg" gap="sm" align="flex-end">
        <DatePickerInput
          type="range"
          label="Abertas no período"
          valueFormat="DD/MM/YYYY"
          leftSection={<IconCalendar size={16} />}
          value={periodo}
          onChange={setPeriodo}
          clearable
          w={260}
        />
        <Select
          label="Setor"
          placeholder="Todos"
          clearable
          w={180}
          value={setorId}
          onChange={setSetorId}
          data={(cadastros?.setores ?? []).map((s) => ({ value: String(s.id), label: s.nome }))}
        />
        <Select
          label="Tipo de divergência"
          placeholder="Todos"
          clearable
          searchable
          w={240}
          value={tipoId}
          onChange={setTipoId}
          data={(cadastros?.tipos ?? []).map((t) => ({ value: String(t.id), label: t.nome }))}
        />
      </Group>
      {carregando && !r && <Carregando />}
      {erro && <ErroCarregar mensagem={erro} />}
      {r && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
            <Kpi rotulo="Notas com divergência" valor={r.resumo.total} rodape={textoPeriodo} />
            <Kpi
              rotulo="Taxa de solução no SLA"
              valor={formatarPercentual(r.resumo.taxaSla)}
              rodape={`Meta: ${META_SLA}% · ${r.resumo.atrasadas} vencida(s) em aberto`}
              destaque={r.resumo.taxaSla !== null && r.resumo.taxaSla < META_SLA}
            />
            <Kpi
              rotulo="Tempo médio de resolução"
              valor={formatarNumero(r.resumo.diasMediosResolucao)}
              rodape="Dias corridos até a conclusão"
            />
            <Kpi
              rotulo="Reabertas"
              valor={formatarPercentual(r.resumo.taxaReabertura)}
              rodape="Após devolução ao Fiscal"
            />
          </SimpleGrid>

          <Grid gap="lg">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Stack gap="lg">
                <Painel titulo="Motivos recorrentes">
                  {r.porTipo.length === 0 ? (
                    <Vazio titulo="Sem ocorrências no período" />
                  ) : (
                    r.porTipo
                      .slice(0, 8)
                      .map((t) => (
                        <BarraHorizontal
                          key={t.tipo}
                          rotulo={t.tipo}
                          valor={`${t.quantidade} ocorrência${t.quantidade > 1 ? 's' : ''}`}
                          percentual={(t.quantidade / maiorMotivo) * 100}
                        />
                      ))
                  )}
                </Painel>
                <Painel titulo="Ocorrências por setor">
                  {r.porSetor.length === 0 ? (
                    <Vazio titulo="Sem ocorrências no período" />
                  ) : (
                    <BarChart
                      h={220}
                      data={r.porSetor.map((s) => ({
                        setor: s.nome,
                        'No prazo ou em dia': s.total - s.atrasadas,
                        Vencidas: s.atrasadas,
                      }))}
                      dataKey="setor"
                      type="stacked"
                      series={[
                        { name: 'No prazo ou em dia', color: 'dark.4' },
                        { name: 'Vencidas', color: 'itaxRed.6' },
                      ]}
                      withLegend
                      tickLine="none"
                      gridAxis="y"
                      yAxisProps={{ allowDecimals: false, width: 30 }}
                    />
                  )}
                </Painel>
                <Painel
                  titulo="Tempo com cada setor"
                  extra={
                    <Text fz="xs" c="dimmed">
                      Horas corridas desde o encaminhamento até a devolução ou o repasse
                    </Text>
                  }
                >
                  <TabelaTempo linhas={r.tempoPorSetor} rotulo="Setor" />
                </Painel>
                <Painel titulo="Tempo por responsável">
                  <TabelaTempo linhas={r.porResponsavel} rotulo="Responsável" />
                </Painel>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="lg">
                <Painel titulo="SLA por setor">
                  {r.porSetor.length === 0 ? (
                    <Vazio titulo="Sem dados" />
                  ) : (
                    r.porSetor.map((s) => (
                      <BarraHorizontal
                        key={s.id}
                        rotulo={s.nome}
                        valor={s.taxaSla === null ? 'sem conclusões' : `${s.taxaSla}%`}
                        percentual={s.taxaSla ?? 0}
                        cor={s.taxaSla !== null && s.taxaSla < 85 ? 'itaxRed' : 'green'}
                      />
                    ))
                  )}
                  <Text fz="xs" c="dimmed">
                    Cumprido = concluída até o fim do dia do prazo. Vencidas ainda com o setor contam como
                    fora do SLA.
                  </Text>
                </Painel>
                <Painel titulo="Fila por idade de pendência">
                  {r.faixasIdade.map((f) => (
                    <BarraHorizontal
                      key={f.faixa}
                      rotulo={f.faixa}
                      valor={f.quantidade}
                      percentual={(f.quantidade / maiorIdade) * 100}
                      cor="dark"
                    />
                  ))}
                  <Text fz="xs" c="dimmed">
                    Idade média das abertas: {formatarNumero(r.resumo.diasMediosAbertas)} dia(s).
                  </Text>
                </Painel>
                <Painel titulo="Reincidência por fornecedor" semPadding>
                  {r.porFornecedor.length === 0 ? (
                    <Vazio titulo="Sem dados" />
                  ) : (
                    <Table verticalSpacing="xs" fz="sm">
                      <Table.Tbody>
                        {r.porFornecedor.map((f) => (
                          <Table.Tr key={f.cnpj}>
                            <Table.Td pl="lg">
                              <Text fz="sm" fw={600}>
                                {f.nome}
                              </Text>
                              <Text fz="xs" c="dimmed">
                                {formatarCnpj(f.cnpj)} · principal: {f.principalMotivo}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right" pr="lg" fw={800}>
                              {f.quantidade}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Painel>
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      )}
    </>
  );
}
