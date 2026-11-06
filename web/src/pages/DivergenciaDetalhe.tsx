import { Button, Grid, Group, Stack } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { DivergenciaDetalhe as Detalhe } from '../api/tipos';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { Carregando, ErroCarregar } from '../components/Estado';
import { avisarMudanca } from '../components/Layout';
import {
  BotaoRedistribuir,
  Historico,
  ListaAnexos,
  PainelResposta,
  PainelValidacao,
  ResumoTratativa,
  TempoResponsaveis,
} from '../components/Tratativa';
import { Destaque, Painel, TituloSecao } from '../components/ui';
import { formatarDataHora } from '../utils/formato';

/** Tela da ocorrência: mostra a ação que cabe a quem está logado. */
export function DivergenciaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario, temPerfil } = useAuth();
  const {
    dados: d,
    carregando,
    erro,
    setDados,
  } = useApi(() => api.get<Detalhe>(`/divergencias/${id}`), [id]);

  const atualizar = (novo: Detalhe) => {
    setDados(novo);
    avisarMudanca();
  };

  if (carregando) return <Carregando />;
  if (erro || !d) return <ErroCarregar mensagem={erro ?? 'Divergência não encontrada'} />;

  const fiscal = temPerfil('FISCAL', 'GESTOR', 'ADMIN');
  const comSetor = d.status === 'PENDENTE' || d.status === 'EM_TRATAMENTO';
  const ehResponsavel = d.responsavelAtual?.id === usuario?.id;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          Voltar
        </Button>
        {fiscal && comSetor && (
          <BotaoRedistribuir key={d.responsavelAtual?.id} d={d} aoAtualizar={atualizar} />
        )}
      </Group>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <Painel titulo="Ocorrência">
              <ResumoTratativa d={d} />
            </Painel>
            {comSetor && ehResponsavel && (
              <Painel titulo="Sua tratativa">
                <PainelResposta key={`${d.status}-${d.reaberturas}`} d={d} aoAtualizar={atualizar} />
              </Painel>
            )}
            {d.status === 'DEVOLVIDA' && fiscal && (
              <Painel titulo="Validação do Fiscal">
                <PainelValidacao key={d.devolvidaEm} d={d} aoAtualizar={atualizar} />
              </Painel>
            )}
            {d.status === 'CONCLUIDA' && (
              <Painel titulo="Conclusão">
                <TituloSecao>Devolutiva do setor</TituloSecao>
                <Destaque cor="violet">{d.devolutiva}</Destaque>
                <TituloSecao>
                  <span style={{ display: 'block', marginTop: 16 }}>
                    Parecer do Fiscal · {formatarDataHora(d.concluidaEm)}
                  </span>
                </TituloSecao>
                <Destaque cor="green">{d.parecer}</Destaque>
              </Painel>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Painel titulo="Histórico de movimentações">
              <Historico d={d} />
            </Painel>
            <Painel titulo="Tempo com cada responsável">
              <TempoResponsaveis d={d} />
            </Painel>
            <Painel titulo="Anexos">
              <ListaAnexos d={d} />
            </Painel>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
