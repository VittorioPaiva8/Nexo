import { Alert, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertTriangle, IconCopy, IconFileCheck, IconSend, IconUpload, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { ResultadoImportacao } from '../api/tipos';
import { EncaminharModal } from '../components/EncaminharModal';
import { TabelaNotas } from '../components/TabelaNotas';
import { Titulo } from '../components/Titulo';

function Numero({
  rotulo,
  valor,
  cor,
  icone,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  icone: React.ReactNode;
}) {
  return (
    <Card>
      <Group>
        <ThemeIcon color={cor} variant="light" size="lg">
          {icone}
        </ThemeIcon>
        <div>
          <Text fz="xl" fw={700}>
            {valor}
          </Text>
          <Text fz="sm" c="dimmed">
            {rotulo}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

export function Importar() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [modal, { open, close }] = useDisclosure();
  const navigate = useNavigate();

  async function enviar(arquivos: File[]) {
    setEnviando(true);
    setErro(null);
    setSelecionadas([]);
    const corpo = new FormData();
    arquivos.forEach((a) => corpo.append('arquivos', a));
    try {
      setResultado(await api.post<ResultadoImportacao>('/notas/importar', corpo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Stack>
      <Titulo
        titulo="Importar NF-es"
        descricao="Envie os XMLs, marque as notas que não deram certo e encaminhe para quem precisa resolver."
      />

      <Dropzone
        onDrop={enviar}
        loading={enviando}
        accept={{ 'application/xml': ['.xml'], 'text/xml': ['.xml'] }}
        maxSize={5 * 1024 * 1024}
        maxFiles={500}
        onReject={() => setErro('Envie apenas arquivos .xml de até 5 MB (máximo de 500 por vez).')}
      >
        <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={48} stroke={1.25} color="var(--mantine-color-itaxRed-6)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={48} stroke={1.25} color="var(--mantine-color-itaxRed-6)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconUpload size={48} stroke={1.25} color="var(--mantine-color-gray-6)" />
          </Dropzone.Idle>
          <div>
            <Text fz="lg" fw={600}>
              Arraste os XMLs das NF-es aqui ou clique para escolher
            </Text>
            <Text fz="sm" c="dimmed">
              Até 500 arquivos por envio. Notas já importadas são ignoradas automaticamente.
            </Text>
          </div>
        </Group>
      </Dropzone>

      {erro && (
        <Alert color="itaxRed" icon={<IconAlertTriangle size={18} />}>
          {erro}
        </Alert>
      )}

      {resultado && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Numero
              rotulo="Importadas"
              valor={resultado.importacao.totalImportadas}
              cor="green"
              icone={<IconFileCheck size={20} />}
            />
            <Numero
              rotulo="Já existiam"
              valor={resultado.importacao.totalDuplicadas}
              cor="gray"
              icone={<IconCopy size={20} />}
            />
            <Numero
              rotulo="Com erro"
              valor={resultado.importacao.totalInvalidas}
              cor="itaxRed"
              icone={<IconX size={20} />}
            />
          </SimpleGrid>

          {resultado.erros.length > 0 && (
            <Alert color="itaxRed" title="Arquivos não importados" icon={<IconAlertTriangle size={18} />}>
              <List size="sm">
                {resultado.erros.map((e) => (
                  <List.Item key={e.arquivo}>
                    <b>{e.arquivo}</b>: {e.motivo}
                  </List.Item>
                ))}
              </List>
            </Alert>
          )}

          {resultado.notas.length > 0 && (
            <Card p={0}>
              <Group justify="space-between" p="md">
                <Text fw={600}>Marque as notas com divergência</Text>
                <Button
                  leftSection={<IconSend size={16} />}
                  disabled={selecionadas.length === 0}
                  onClick={open}
                >
                  Encaminhar {selecionadas.length > 0 ? `(${selecionadas.length})` : ''}
                </Button>
              </Group>
              <TabelaNotas
                notas={resultado.notas}
                selecionadas={selecionadas}
                aoSelecionar={setSelecionadas}
              />
            </Card>
          )}
        </>
      )}

      <EncaminharModal
        notaIds={selecionadas}
        aberto={modal}
        aoFechar={close}
        aoConcluir={() => {
          close();
          navigate('/acompanhamento');
        }}
      />
    </Stack>
  );
}
