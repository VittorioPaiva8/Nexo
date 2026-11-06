import { SegmentedControl, Stack, Tabs } from '@mantine/core';
import { useState } from 'react';
import { ListaDivergencias } from '../components/ListaDivergencias';
import { Titulo } from '../components/Titulo';

export function Acompanhamento() {
  const [escopo, setEscopo] = useState<'solicitadas' | 'todas'>('solicitadas');
  return (
    <Stack>
      <Titulo
        titulo="Acompanhamento"
        descricao="Divergências que você encaminhou: revise os retornos, aceite ou devolva."
        acoes={
          <SegmentedControl
            value={escopo}
            onChange={(v) => setEscopo(v as typeof escopo)}
            data={[
              { value: 'solicitadas', label: 'Minhas solicitações' },
              { value: 'todas', label: 'Todas' },
            ]}
          />
        }
      />
      <Tabs defaultValue="revisar" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="revisar">Para revisar</Tabs.Tab>
          <Tabs.Tab value="pendentes">Com o responsável</Tabs.Tab>
          <Tabs.Tab value="resolvidas">Resolvidas</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="revisar">
          <ListaDivergencias
            escopo={escopo}
            status="AGUARDANDO_REVISAO"
            vazio="Nenhum retorno para revisar"
          />
        </Tabs.Panel>
        <Tabs.Panel value="pendentes">
          <ListaDivergencias escopo={escopo} status="PENDENTE" vazio="Nada pendente com responsáveis" />
        </Tabs.Panel>
        <Tabs.Panel value="resolvidas">
          <ListaDivergencias escopo={escopo} status="RESOLVIDA" vazio="Nenhuma divergência resolvida" />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
