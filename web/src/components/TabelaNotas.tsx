import { Checkbox, Table, Text } from '@mantine/core';
import type { NotaFiscal } from '../api/tipos';
import { formatarCnpj, formatarData, formatarMoeda } from '../utils/formato';
import { BadgeNota } from './rotulos';

/** Tabela de notas com seleção múltipla para marcar as divergentes. */
export function TabelaNotas({
  notas,
  selecionadas,
  aoSelecionar,
  aoAbrir,
}: {
  notas: NotaFiscal[];
  selecionadas: number[];
  aoSelecionar: (ids: number[]) => void;
  aoAbrir?: (nota: NotaFiscal) => void;
}) {
  const todas = notas.length > 0 && notas.every((n) => selecionadas.includes(n.id));
  const algumas = notas.some((n) => selecionadas.includes(n.id));
  const alternar = (id: number) =>
    aoSelecionar(selecionadas.includes(id) ? selecionadas.filter((s) => s !== id) : [...selecionadas, id]);

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm" striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={40}>
              <Checkbox
                aria-label="Selecionar todas"
                checked={todas}
                indeterminate={algumas && !todas}
                onChange={() =>
                  aoSelecionar(
                    todas
                      ? selecionadas.filter((s) => !notas.some((n) => n.id === s))
                      : [...new Set([...selecionadas, ...notas.map((n) => n.id)])],
                  )
                }
              />
            </Table.Th>
            <Table.Th>Número</Table.Th>
            <Table.Th>Emitente</Table.Th>
            <Table.Th>Emissão</Table.Th>
            <Table.Th ta="right">Valor</Table.Th>
            <Table.Th>Situação</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {notas.map((n) => (
            <Table.Tr
              key={n.id}
              bg={selecionadas.includes(n.id) ? 'var(--mantine-color-itaxRed-0)' : undefined}
              style={{ cursor: aoAbrir ? 'pointer' : undefined }}
              onClick={() => aoAbrir?.(n)}
            >
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`Selecionar nota ${n.numero}`}
                  checked={selecionadas.includes(n.id)}
                  onChange={() => alternar(n.id)}
                />
              </Table.Td>
              <Table.Td>
                <Text fw={600} fz="sm">
                  {n.numero}
                </Text>
                <Text fz="xs" c="dimmed">
                  Série {n.serie}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text fz="sm">{n.emitenteNome}</Text>
                <Text fz="xs" c="dimmed">
                  {formatarCnpj(n.emitenteCnpj)}
                </Text>
              </Table.Td>
              <Table.Td>{formatarData(n.dataEmissao)}</Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {formatarMoeda(n.valorTotal)}
              </Table.Td>
              <Table.Td>
                <BadgeNota status={n.status} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
