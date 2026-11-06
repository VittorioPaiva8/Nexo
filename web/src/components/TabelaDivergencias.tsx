import { Card, Group, Stack, Table, Text } from '@mantine/core';
import { useNavigate } from 'react-router';
import type { Divergencia } from '../api/tipos';
import { formatarDia } from '../utils/formato';
import { BadgeDivergencia, BadgePrioridade } from './rotulos';

/** Lista da central: tabela no computador e cartões no celular. */
export function TabelaDivergencias({ itens }: { itens: Divergencia[] }) {
  const navigate = useNavigate();
  const abrir = (d: Divergencia) => navigate(`/divergencias/${d.id}`);

  return (
    <>
      <Table.ScrollContainer minWidth={980} visibleFrom="sm">
        <Table highlightOnHover verticalSpacing="sm" fz="sm">
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th>Protocolo</Table.Th>
              <Table.Th>NF</Table.Th>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Divergência</Table.Th>
              <Table.Th>Setor</Table.Th>
              <Table.Th>Responsável</Table.Th>
              <Table.Th>Prazo</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((d) => (
              <Table.Tr key={d.id} className="linha-clicavel" onClick={() => abrir(d)}>
                <Table.Td>
                  <Text fz="sm" fw={800} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {d.protocolo}
                  </Text>
                </Table.Td>
                <Table.Td fw={700}>{d.notaFiscal.numero}</Table.Td>
                <Table.Td maw={200}>
                  <Text fz="sm" truncate>
                    {d.notaFiscal.emitenteNome}
                  </Text>
                </Table.Td>
                <Table.Td maw={200}>
                  <Group gap={4} wrap="nowrap">
                    <Text fz="sm" truncate>
                      {d.tipo.nome}
                    </Text>
                    <BadgePrioridade prioridade={d.prioridade} />
                  </Group>
                </Table.Td>
                <Table.Td>{d.setor.nome}</Table.Td>
                <Table.Td>{d.responsavelAtual?.nome ?? '—'}</Table.Td>
                <Table.Td c={d.atrasada ? 'itaxRed' : undefined} fw={d.atrasada ? 700 : undefined}>
                  {formatarDia(d.prazo)}
                </Table.Td>
                <Table.Td>
                  <BadgeDivergencia status={d.status} atrasada={d.atrasada} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Stack gap="xs" p="sm" hiddenFrom="sm">
        {itens.map((d) => (
          <Card key={d.id} withBorder padding="sm" className="linha-clicavel" onClick={() => abrir(d)}>
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Text fz="sm" fw={800}>
                {d.protocolo} · NF {d.notaFiscal.numero}
              </Text>
              <BadgePrioridade prioridade={d.prioridade} />
            </Group>
            <Text fz="sm" truncate>
              {d.notaFiscal.emitenteNome}
            </Text>
            <Text fz="xs" c="dimmed">
              {d.tipo.nome} · {d.setor.nome} · {d.responsavelAtual?.nome ?? '—'}
            </Text>
            <Group justify="space-between" mt={6}>
              <BadgeDivergencia status={d.status} atrasada={d.atrasada} />
              <Text fz="xs" c={d.atrasada ? 'itaxRed' : 'dimmed'}>
                Prazo {formatarDia(d.prazo)}
              </Text>
            </Group>
          </Card>
        ))}
      </Stack>
    </>
  );
}
