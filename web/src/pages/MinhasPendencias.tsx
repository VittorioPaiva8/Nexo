import { Stack, Tabs } from '@mantine/core';
import { ListaDivergencias } from '../components/ListaDivergencias';
import { Titulo } from '../components/Titulo';

export function MinhasPendencias() {
  return (
    <Stack>
      <Titulo
        titulo="Minhas pendências"
        descricao="Notas encaminhadas para você. Responda com uma justificativa ou a correção para devolver a quem pediu."
      />
      <Tabs defaultValue="pendentes" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="pendentes">Para resolver</Tabs.Tab>
          <Tabs.Tab value="respondidas">Respondidas, aguardando revisão</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pendentes">
          <ListaDivergencias
            escopo="minhas"
            status="PENDENTE"
            vazio="Nenhuma pendência com você"
            mostrarSolicitante
          />
        </Tabs.Panel>
        <Tabs.Panel value="respondidas">
          <ListaDivergencias
            escopo="minhas"
            status="AGUARDANDO_REVISAO"
            vazio="Nada aguardando revisão"
            mostrarSolicitante
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
