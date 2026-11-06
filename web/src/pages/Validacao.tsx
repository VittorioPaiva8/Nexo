import { Alert, Button, SimpleGrid, Stack } from '@mantine/core';
import { useNavigate } from 'react-router';
import { Vazio } from '../components/Estado';
import { FilaComDetalhe } from '../components/Fila';
import {
  Historico,
  PainelValidacao,
  RegraControle,
  ResumoTratativa,
  TempoResponsaveis,
} from '../components/Tratativa';
import { Cabecalho, Painel } from '../components/ui';

export function Validacao() {
  const navigate = useNavigate();
  return (
    <>
      <Cabecalho
        sobretitulo="Controle de devoluções"
        titulo="Validação do Fiscal"
        descricao="Confirme a correção antes de concluir a ocorrência ou reabrir a tratativa."
        acoes={
          <Button variant="default" onClick={() => navigate('/divergencias')}>
            Abrir central de divergências
          </Button>
        }
      />
      <FilaComDetalhe
        escopo="validacao"
        tituloLista="Devolvidas para conferência"
        vazio={
          <Vazio titulo="Nenhuma devolução aguardando">
            As correções devolvidas pelos setores aparecem aqui.
          </Vazio>
        }
        detalhe={(d, atualizar) =>
          d.status !== 'DEVOLVIDA' ? (
            <Alert color={d.status === 'CONCLUIDA' ? 'green' : 'orange'} title={d.protocolo}>
              {d.status === 'CONCLUIDA'
                ? 'Tratativa concluída mediante validação fiscal.'
                : `Reaberta e devolvida para ${d.responsavelAtual?.nome}.`}
            </Alert>
          ) : (
            <>
              <Painel titulo="Tratativa devolvida para conferência">
                <Stack gap="lg">
                  <ResumoTratativa d={d} />
                  <PainelValidacao key={d.id} d={d} aoAtualizar={atualizar} />
                </Stack>
              </Painel>
              <SimpleGrid cols={{ base: 1, xl: 2 }}>
                <Painel titulo="Histórico de movimentações">
                  <Historico d={d} />
                </Painel>
                <Stack gap="lg">
                  <Painel titulo="Tempo com os setores">
                    <TempoResponsaveis d={d} />
                  </Painel>
                  <RegraControle />
                </Stack>
              </SimpleGrid>
            </>
          )
        }
      />
    </>
  );
}
