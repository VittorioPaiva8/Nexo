import { Box, Card, Grid, Group, Stack, Text } from '@mantine/core';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/cliente';
import type { Divergencia, DivergenciaDetalhe } from '../api/tipos';
import { useApi } from '../api/useApi';
import { formatarDia } from '../utils/formato';
import { Carregando, ErroCarregar, Vazio } from './Estado';
import { BadgeDivergencia, BadgePrioridade } from './rotulos';
import { avisarMudanca } from './Layout';
import { Painel } from './ui';

/**
 * Lista à esquerda e a tratativa selecionada à direita (Minhas tratativas e Validação fiscal).
 * Quando uma ação tira a divergência da fila, a lista é recarregada.
 */
export function FilaComDetalhe({
  escopo,
  tituloLista,
  vazio,
  aoMudar,
  detalhe,
}: {
  escopo: 'minhas' | 'validacao';
  tituloLista: string;
  vazio: ReactNode;
  aoMudar?: () => void;
  detalhe: (d: DivergenciaDetalhe, atualizar: (d: DivergenciaDetalhe) => void) => ReactNode;
}) {
  const lista = useApi(() => api.pagina<Divergencia>('/divergencias', { escopo, porPagina: 100 }), [escopo]);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [atual, setAtual] = useState<DivergenciaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const itens = lista.dados?.data ?? [];

  useEffect(() => {
    if (!selecionada && itens[0]) setSelecionada(itens[0].id);
  }, [itens, selecionada]);

  useEffect(() => {
    if (!selecionada) return setAtual(null);
    setErro(null);
    api
      .get<DivergenciaDetalhe>(`/divergencias/${selecionada}`)
      .then(setAtual)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  }, [selecionada]);

  function atualizar(d: DivergenciaDetalhe) {
    setAtual(d);
    aoMudar?.();
    avisarMudanca();
    void lista.recarregar();
  }

  if (lista.carregando && !lista.dados) return <Carregando />;
  if (lista.erro) return <ErroCarregar mensagem={lista.erro} />;

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 5, xl: 4 }}>
        <Painel
          titulo={tituloLista}
          extra={
            <Text fz="xs" c="dimmed">
              {itens.length} na fila
            </Text>
          }
          semPadding
        >
          {itens.length === 0 ? (
            <Box p="lg">{vazio}</Box>
          ) : (
            itens.map((d) => (
              <Box
                key={d.id}
                className="item-lista"
                data-ativo={d.id === selecionada}
                px="lg"
                py="sm"
                style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                onClick={() => setSelecionada(d.id)}
              >
                <Group justify="space-between" gap={6}>
                  <Text fz="sm" fw={800} style={{ whiteSpace: 'nowrap' }}>
                    {d.protocolo} · NF {d.notaFiscal.numero}
                  </Text>
                  <BadgeDivergencia status={d.status} atrasada={d.atrasada} />
                </Group>
                <Text fz="sm" mt={2}>
                  {d.tipo.nome}
                </Text>
                <Text fz="sm" c="dimmed" truncate>
                  {d.notaFiscal.emitenteNome}
                </Text>
                <Group gap={6} mt={2}>
                  <Text fz="xs" c={d.atrasada ? 'itaxRed' : 'dimmed'}>
                    {escopo === 'minhas'
                      ? `Prazo ${formatarDia(d.prazo)}`
                      : `Responsável: ${d.responsavelAtual?.nome} · ${d.setor.nome}`}
                  </Text>
                  <BadgePrioridade prioridade={d.prioridade} />
                </Group>
              </Box>
            ))
          )}
        </Painel>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7, xl: 8 }}>
        {erro && <ErroCarregar mensagem={erro} />}
        {selecionada && !atual && !erro && <Carregando />}
        {atual && <Stack gap="lg">{detalhe(atual, atualizar)}</Stack>}
        {!selecionada && itens.length === 0 && (
          <Card withBorder>
            <Vazio titulo="Nada para fazer agora" />
          </Card>
        )}
      </Grid.Col>
    </Grid>
  );
}
