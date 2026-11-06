import { BarChart } from '@mantine/charts';
import { Anchor, Button, Grid, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconCircleCheck, IconClockHour4, IconListDetails, IconProgress } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { PainelGeral } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Carregando, ErroCarregar, Vazio } from '../components/Estado';
import { BadgeDivergencia, BadgePrioridade } from '../components/rotulos';
import { BarraHorizontal, Cabecalho, Estatistica, Kpi, Painel as Quadro } from '../components/ui';
import { formatarDia, formatarDias, formatarPercentual } from '../utils/formato';

const dois = (n: number) => String(n).padStart(2, '0');

export function Painel() {
  const navigate = useNavigate();
  const { dados: p, carregando, erro } = useApi(() => api.get<PainelGeral>('/metricas/painel'), []);

  return (
    <>
      <Cabecalho
        sobretitulo="Central de tratativas"
        titulo="Visão geral do Fluxo Fiscal"
        descricao="Controle de divergências de notas fiscais e movimentações entre setores."
        acoes={
          <>
            <Button
              variant="default"
              leftSection={<IconListDetails size={16} />}
              onClick={() => navigate('/divergencias')}
            >
              Ver divergências
            </Button>
            <Button onClick={() => navigate('/nova')}>+ Nova divergência</Button>
          </>
        }
      />
      {carregando && <Carregando />}
      {erro && <ErroCarregar mensagem={erro} />}
      {p && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
            <Kpi
              rotulo="Divergências abertas"
              valor={dois(p.kpis.abertas)}
              rodape={`+ ${p.kpis.cadastradasHoje} cadastradas hoje`}
              icone={<IconListDetails size={20} />}
            />
            <Kpi
              rotulo="Em tratamento"
              valor={dois(p.kpis.emTratamento)}
              rodape="Com os setores responsáveis"
              icone={<IconProgress size={20} />}
              cor="blue"
            />
            <Kpi
              rotulo="Aguardando validação"
              valor={dois(p.kpis.aguardandoValidacao)}
              rodape="Devolvidas ao Fiscal"
              icone={<IconClockHour4 size={20} />}
              cor="yellow"
            />
            <Kpi
              rotulo="Concluídas no mês"
              valor={dois(p.kpis.concluidasMes)}
              rodape={
                p.kpis.noPrazoMes === null
                  ? 'Nenhuma concluída ainda'
                  : `${p.kpis.noPrazoMes}% dentro do prazo`
              }
              icone={<IconCircleCheck size={20} />}
              cor="green"
            />
          </SimpleGrid>

          <Grid gap="lg">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Stack gap="lg">
                <Quadro
                  titulo="Pendências que exigem atenção"
                  extra={
                    <Anchor fz="sm" fw={700} c="itaxRed" onClick={() => navigate('/divergencias')}>
                      Ver todas →
                    </Anchor>
                  }
                >
                  {p.atencao.length === 0 ? (
                    <Vazio titulo="Nenhuma pendência aberta" />
                  ) : (
                    <Stack gap={0}>
                      {p.atencao.map((a, i) => (
                        <Group
                          key={a.id}
                          gap="md"
                          py="sm"
                          wrap="nowrap"
                          className="linha-clicavel"
                          onClick={() => navigate(`/divergencias/${a.id}`)}
                          style={{ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}
                        >
                          <Text fz="xs" fw={800} c="dimmed" w={96} style={{ flexShrink: 0 }}>
                            {a.protocolo}
                          </Text>
                          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={6} wrap="nowrap">
                              <Text fz="sm" fw={700} truncate>
                                NF {a.numeroNf} • {a.fornecedor}
                              </Text>
                              <BadgePrioridade prioridade={a.prioridade} />
                            </Group>
                            <Text fz="xs" c="dimmed" truncate>
                              {a.tipo} · {a.setor} · prazo {formatarDia(a.prazo)}
                            </Text>
                          </Stack>
                          <BadgeDivergencia status={a.status} atrasada={a.atrasada} />
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Quadro>
                <Quadro
                  titulo="Volume de divergências por dia"
                  extra={
                    <Text fz="xs" c="dimmed">
                      Últimos 12 dias úteis
                    </Text>
                  }
                >
                  <BarChart
                    h={220}
                    data={p.volumePorDia.map((v) => ({
                      dia: formatarDia(v.dia).slice(0, 5),
                      Novas: v.quantidade,
                    }))}
                    dataKey="dia"
                    series={[{ name: 'Novas', color: 'dark.4', label: 'Novas divergências' }]}
                    tickLine="none"
                    gridAxis="y"
                    barProps={{ radius: 4 }}
                    yAxisProps={{ allowDecimals: false, width: 30 }}
                  />
                </Quadro>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="lg">
                <Quadro
                  titulo="Principais origens"
                  extra={
                    <Text fz="xs" c="dimmed">
                      Últimos 30 dias
                    </Text>
                  }
                >
                  {p.principaisOrigens.length === 0 ? (
                    <Vazio titulo="Sem divergências no período" />
                  ) : (
                    p.principaisOrigens.map((o) => (
                      <BarraHorizontal
                        key={o.tipo}
                        rotulo={o.tipo}
                        valor={`${o.percentual}%`}
                        percentual={o.percentual}
                      />
                    ))
                  )}
                </Quadro>
                <Quadro titulo="SLA das tratativas">
                  <SimpleGrid cols={2}>
                    <Estatistica
                      valor={formatarDias(p.sla.diasMediosResolucao)}
                      legenda="Tempo médio de solução"
                    />
                    <Estatistica
                      valor={dois(p.sla.vencidas)}
                      legenda="Tratativas vencidas"
                      cor={p.sla.vencidas ? 'itaxRed' : undefined}
                    />
                    <Estatistica
                      valor={formatarPercentual(p.sla.responsaveisAtribuidos)}
                      legenda="Responsáveis atribuídos"
                    />
                    <Estatistica valor={formatarPercentual(p.sla.taxaReabertura)} legenda="Reabertura" />
                  </SimpleGrid>
                  <Text fz="xs" c="dimmed" mt="md">
                    Calculado sobre as divergências gravadas no sistema.
                  </Text>
                </Quadro>
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      )}
    </>
  );
}
