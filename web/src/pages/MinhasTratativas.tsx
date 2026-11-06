import { Alert, Button, SimpleGrid } from '@mantine/core';
import { IconListDetails } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { Contadores } from '../api/tipos';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { Vazio } from '../components/Estado';
import { FilaComDetalhe } from '../components/Fila';
import { Historico, ListaAnexos, PainelResposta, ResumoTratativa } from '../components/Tratativa';
import { Cabecalho, Kpi, Painel } from '../components/ui';

const dois = (n: number | undefined) => (n === undefined ? '—' : String(n).padStart(2, '0'));

export function MinhasTratativas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const contadores = useApi(() => api.get<Contadores>('/divergencias/contadores'), []);
  const c = contadores.dados;

  return (
    <>
      <Cabecalho
        sobretitulo="Fila do responsável"
        titulo={`Minhas tratativas${usuario?.setor ? ` — ${usuario.setor.nome}` : ''}`}
        descricao="Receba solicitações do Fiscal, registre as providências e devolva para validação."
        acoes={
          <Button
            variant="default"
            leftSection={<IconListDetails size={16} />}
            onClick={() => navigate('/divergencias')}
          >
            Todas as pendências
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Kpi rotulo="Minhas solicitações" valor={dois(c?.minhas)} rodape="Designadas a você" />
        <Kpi
          rotulo="Vencem em até 24h"
          valor={dois(c?.vencendo)}
          rodape="Tratativas com prioridade"
          destaque={Boolean(c?.vencendo)}
        />
        <Kpi
          rotulo="Resolvidas nesta semana"
          valor={dois(c?.resolvidasSemana)}
          rodape="Devolvidas ao Fiscal"
        />
      </SimpleGrid>
      <FilaComDetalhe
        escopo="minhas"
        tituloLista="Solicitações recebidas"
        aoMudar={() => void contadores.recarregar()}
        vazio={
          <Vazio titulo="Nenhuma solicitação com você">
            Quando o Fiscal encaminhar uma divergência, ela aparece aqui.
          </Vazio>
        }
        detalhe={(d, atualizar) =>
          d.status === 'DEVOLVIDA' || d.status === 'CONCLUIDA' ? (
            <Alert color="green" title={`${d.protocolo} devolvida ao Fiscal`}>
              Obrigado! A tratativa saiu da sua fila e aguarda a validação.
            </Alert>
          ) : (
            <>
              <Painel titulo="Tratativa atribuída">
                <ResumoTratativa d={d} />
              </Painel>
              <Painel titulo="Ação executada / devolutiva obrigatória">
                <PainelResposta key={`${d.id}-${d.status}`} d={d} aoAtualizar={atualizar} />
              </Painel>
              <SimpleGrid cols={{ base: 1, xl: 2 }}>
                <Painel titulo="Histórico">
                  <Historico d={d} />
                </Painel>
                <Painel titulo="Anexos">
                  <ListaAnexos d={d} />
                </Painel>
              </SimpleGrid>
            </>
          )
        }
      />
    </>
  );
}
