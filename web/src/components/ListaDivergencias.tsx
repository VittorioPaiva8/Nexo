import { Badge, Card, Group, Pagination, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { Divergencia, StatusDivergencia } from '../api/tipos';
import { useApi } from '../api/useApi';
import { formatarData, formatarDuracao, formatarMoeda } from '../utils/formato';
import { Carregando, ErroCarregar, Vazio } from './Estado';
import { BadgeDivergencia, corDoTempo } from './rotulos';

const POR_PAGINA = 20;

/** Lista paginada de divergências; clicar abre o detalhe com o histórico. */
export function ListaDivergencias({
  escopo,
  status,
  vazio,
  mostrarSolicitante = false,
}: {
  escopo: 'minhas' | 'solicitadas' | 'todas';
  status?: StatusDivergencia;
  vazio: string;
  mostrarSolicitante?: boolean;
}) {
  const [pagina, setPagina] = useState(1);
  const navigate = useNavigate();
  const celular = useMediaQuery('(max-width: 48em)');
  const { dados, carregando, erro } = useApi(
    () => api.pagina<Divergencia>('/divergencias', { escopo, status, pagina, porPagina: POR_PAGINA }),
    [escopo, status, pagina],
  );

  if (carregando) return <Carregando />;
  if (erro) return <ErroCarregar mensagem={erro} />;
  if (!dados || dados.data.length === 0) return <Vazio titulo={vazio} />;

  const paginacao = dados.meta.total > POR_PAGINA && (
    <Group justify="flex-end">
      <Pagination value={pagina} onChange={setPagina} total={Math.ceil(dados.meta.total / POR_PAGINA)} />
    </Group>
  );

  if (celular) {
    return (
      <Stack gap="sm">
        {dados.data.map((d) => {
          const pessoa = mostrarSolicitante ? d.solicitante : d.responsavelAtual;
          return (
            <Card key={d.id} onClick={() => navigate(`/divergencias/${d.id}`)} style={{ cursor: 'pointer' }}>
              <Group justify="space-between" wrap="nowrap" mb={4}>
                <Text fw={600}>NF {d.notaFiscal.numero}</Text>
                <BadgeDivergencia status={d.status} />
              </Group>
              <Text fz="sm">{d.tipo.nome}</Text>
              <Text fz="xs" c="dimmed" lineClamp={2}>
                {d.notaFiscal.emitenteNome} · {formatarMoeda(d.notaFiscal.valorTotal)}
              </Text>
              <Group justify="space-between" mt="xs" wrap="nowrap">
                <Text fz="xs" c="dimmed">
                  {mostrarSolicitante ? 'De' : 'Com'} {pessoa?.nome ?? '—'}
                </Text>
                {d.horasComResponsavelAtual !== null && (
                  <Badge variant="outline" color={corDoTempo(d.horasComResponsavelAtual)}>
                    {formatarDuracao(d.horasComResponsavelAtual)}
                  </Badge>
                )}
              </Group>
            </Card>
          );
        })}
        {paginacao}
      </Stack>
    );
  }

  return (
    <Stack>
      <Card p={0}>
        <Table.ScrollContainer minWidth={820}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nota</Table.Th>
                <Table.Th>Divergência</Table.Th>
                <Table.Th>{mostrarSolicitante ? 'Solicitante' : 'Responsável'}</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th>Com o responsável</Table.Th>
                <Table.Th>Aberta</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dados.data.map((d) => {
                const pessoa = mostrarSolicitante ? d.solicitante : d.responsavelAtual;
                return (
                  <Table.Tr
                    key={d.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/divergencias/${d.id}`)}
                  >
                    <Table.Td>
                      <Text fw={600} fz="sm">
                        NF {d.notaFiscal.numero}
                      </Text>
                      <Text fz="xs" c="dimmed" lineClamp={1}>
                        {d.notaFiscal.emitenteNome} · {formatarMoeda(d.notaFiscal.valorTotal)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{d.tipo.nome}</Text>
                      <Text fz="xs" c="dimmed" lineClamp={1} maw={280}>
                        {d.descricao}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{pessoa?.nome ?? '—'}</Text>
                      <Text fz="xs" c="dimmed">
                        {pessoa?.setor?.nome ?? ''}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <BadgeDivergencia status={d.status} />
                    </Table.Td>
                    <Table.Td>
                      {d.horasComResponsavelAtual === null ? (
                        <Text fz="sm" c="dimmed">
                          —
                        </Text>
                      ) : (
                        <Badge variant="outline" color={corDoTempo(d.horasComResponsavelAtual)}>
                          {formatarDuracao(d.horasComResponsavelAtual)}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{formatarData(d.abertaEm)}</Text>
                      <Text fz="xs" c="dimmed">
                        há {formatarDuracao(d.horasAberta)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {paginacao}
    </Stack>
  );
}
