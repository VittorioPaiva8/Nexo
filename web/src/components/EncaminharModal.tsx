import { Alert, Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/cliente';
import type { Divergencia, TipoDivergencia, Usuario } from '../api/tipos';

/** Opções de responsável agrupadas por setor, para o Select. */
export function opcoesResponsaveis(usuarios: Usuario[], excluirId?: number | null) {
  const grupos = new Map<string, { value: string; label: string }[]>();
  for (const u of usuarios) {
    if (u.id === excluirId) continue;
    const setor = u.setor?.nome ?? 'Sem setor';
    grupos.set(setor, [...(grupos.get(setor) ?? []), { value: String(u.id), label: u.nome }]);
  }
  return [...grupos.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([group, items]) => ({ group, items }));
}

export function useResponsaveis() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  useEffect(() => {
    api
      .get<Usuario[]>('/usuarios')
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);
  return usuarios;
}

export function EncaminharModal({
  notaIds,
  aberto,
  aoFechar,
  aoConcluir,
}: {
  notaIds: number[];
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: (criadas: Divergencia[]) => void;
}) {
  const [tipos, setTipos] = useState<TipoDivergencia[]>([]);
  const usuarios = useResponsaveis();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto)
      api.get<TipoDivergencia[]>('/tipos-divergencia').then((t) => setTipos(t.filter((x) => x.ativo)));
  }, [aberto]);

  const form = useForm({
    initialValues: { tipoId: '', responsavelId: '', descricao: '' },
    validate: {
      tipoId: (v) => (v ? null : 'Escolha o tipo de divergência'),
      responsavelId: (v) => (v ? null : 'Escolha quem vai resolver'),
      descricao: (v) => (v.trim().length >= 5 ? null : 'Descreva o que precisa ser ajustado'),
    },
  });

  const opcoes = useMemo(() => opcoesResponsaveis(usuarios), [usuarios]);

  const enviar = form.onSubmit(async (v) => {
    setEnviando(true);
    setErro(null);
    try {
      const criadas = await api.post<Divergencia[]>('/divergencias', {
        notaFiscalIds: notaIds,
        tipoId: Number(v.tipoId),
        responsavelId: Number(v.responsavelId),
        descricao: v.descricao,
      });
      notifications.show({
        color: 'green',
        title: 'Encaminhado',
        message: `${criadas.length} nota(s) enviada(s) para ${criadas[0]?.responsavelAtual?.nome ?? 'o responsável'}.`,
      });
      form.reset();
      aoConcluir(criadas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao encaminhar');
    } finally {
      setEnviando(false);
    }
  });

  return (
    <Modal opened={aberto} onClose={aoFechar} title="Marcar como divergente e encaminhar" size="lg">
      <form onSubmit={enviar}>
        <Stack>
          <Text fz="sm" c="dimmed">
            {notaIds.length} nota(s) selecionada(s). O responsável verá cada uma como pendente e o tempo
            começa a contar agora.
          </Text>
          {erro && <Alert color="itaxRed">{erro}</Alert>}
          <Select
            label="Tipo de divergência"
            data={tipos.map((t) => ({ value: String(t.id), label: t.nome }))}
            searchable
            {...form.getInputProps('tipoId')}
          />
          <Select
            label="Responsável pelo ajuste"
            placeholder="Busque pelo nome"
            data={opcoes}
            searchable
            nothingFoundMessage="Nenhum usuário encontrado"
            {...form.getInputProps('responsavelId')}
          />
          <Textarea
            label="O que precisa ser ajustado"
            placeholder="Ex.: valor da nota diferente do pedido 4512 (R$ 1.500,00)."
            autosize
            minRows={3}
            {...form.getInputProps('descricao')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando}>
              Encaminhar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
