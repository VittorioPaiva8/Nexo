import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPaperclip, IconSend } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { opcoesResponsaveis, useCadastros } from '../api/cadastros';
import { api, ErroApi } from '../api/cliente';
import type { Divergencia, Prioridade } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { Carregando } from '../components/Estado';
import { ROTULO_PRIORIDADE, UNIDADES } from '../components/rotulos';
import { Cabecalho, TituloSecao } from '../components/ui';
import { apenasDigitos, chaveValida, cnpjValido, mascararCnpj } from '../utils/documentos';

interface Valores {
  numero: string;
  serie: string;
  chaveAcesso: string;
  emitenteNome: string;
  emitenteCnpj: string;
  valorTotal: number | string;
  dataEmissao: string | null;
  pedidoCompra: string;
  unidade: string | null;
  centroCusto: string;
  tipoId: string | null;
  setorId: string | null;
  responsavelId: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  valorNf: string;
  valorEsperado: string;
  correcaoEsperada: string;
  descricao: string;
  anexos: File[];
}

const obrigatorio = (rotulo: string) => (v: unknown) => (v === null || v === '' ? `Informe ${rotulo}` : null);

/** Envia os anexos depois de criar a divergência; devolve quantos falharam. */
export async function enviarAnexos(
  divergenciaId: number,
  arquivos: File[],
  categoria: 'APOIO' | 'EVIDENCIA',
) {
  if (arquivos.length === 0) return;
  const corpo = new FormData();
  for (const a of arquivos) corpo.append('arquivos', a);
  await api.post(`/divergencias/${divergenciaId}/anexos?categoria=${categoria}`, corpo);
}

export function NovaDivergencia() {
  const navigate = useNavigate();
  const cadastros = useCadastros();
  const { temPerfil } = useAuth();
  const gestao = temPerfil('GESTOR', 'ADMIN');
  const [erro, setErro] = useState<{ mensagem: string; detalhes?: string[] } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<Valores>({
    initialValues: {
      numero: '',
      serie: '1',
      chaveAcesso: '',
      emitenteNome: '',
      emitenteCnpj: '',
      valorTotal: '',
      dataEmissao: null,
      pedidoCompra: '',
      unidade: null,
      centroCusto: '',
      tipoId: null,
      setorId: null,
      responsavelId: null,
      prioridade: 'NORMAL',
      prazo: null,
      valorNf: '',
      valorEsperado: '',
      correcaoEsperada: '',
      descricao: '',
      anexos: [],
    },
    validate: {
      numero: (v) => (/^\d{1,9}$/.test(v) ? null : 'Número da NF com até 9 dígitos'),
      serie: (v) => (/^\d{1,3}$/.test(v) ? null : 'Série com até 3 dígitos'),
      chaveAcesso: (v) => (!v || chaveValida(v) ? null : 'Chave de acesso inválida (44 dígitos)'),
      emitenteNome: obrigatorio('o fornecedor'),
      emitenteCnpj: (v) => (cnpjValido(v) ? null : 'CNPJ inválido (confira os dígitos)'),
      valorTotal: (v) => (Number(v) > 0 ? null : 'Informe o valor total'),
      tipoId: obrigatorio('o tipo'),
      setorId: obrigatorio('o setor'),
      responsavelId: obrigatorio('o responsável'),
      descricao: (v) =>
        v.trim().length >= 10 ? null : 'Descreva a divergência e a providência (mín. 10 caracteres)',
    },
  });

  const setorId = form.values.setorId ? Number(form.values.setorId) : null;
  const responsaveis = useMemo(
    () => opcoesResponsaveis(cadastros?.usuarios ?? [], setorId, gestao),
    [cadastros, setorId, gestao],
  );
  const preenchidos = [
    form.values.numero && form.values.emitenteCnpj,
    form.values.tipoId && form.values.descricao,
    form.values.responsavelId,
  ].filter(Boolean).length;

  if (!cadastros) return <Carregando />;

  const enviar = form.onSubmit(async (v) => {
    setErro(null);
    setEnviando(true);
    try {
      const [d] = await api.post<Divergencia[]>('/divergencias', {
        nota: {
          numero: v.numero,
          serie: v.serie,
          chaveAcesso: apenasDigitos(v.chaveAcesso) || undefined,
          emitenteNome: v.emitenteNome,
          emitenteCnpj: v.emitenteCnpj,
          valorTotal: Number(v.valorTotal).toFixed(2),
          dataEmissao: v.dataEmissao ? dayjs(v.dataEmissao).format('YYYY-MM-DD') : undefined,
          pedidoCompra: v.pedidoCompra || undefined,
          unidade: v.unidade || undefined,
          centroCusto: v.centroCusto || undefined,
        },
        tipoId: Number(v.tipoId),
        setorId: Number(v.setorId),
        responsavelId: Number(v.responsavelId),
        prioridade: v.prioridade,
        prazo: v.prazo ? dayjs(v.prazo).format('YYYY-MM-DD') : undefined,
        descricao: v.descricao,
        valorNf: v.valorNf || undefined,
        valorEsperado: v.valorEsperado || undefined,
        correcaoEsperada: v.correcaoEsperada || undefined,
      });
      let aviso = '';
      try {
        await enviarAnexos(d!.id, v.anexos, 'APOIO');
      } catch (e) {
        aviso = ` O anexo não foi salvo: ${e instanceof Error ? e.message : 'erro'}.`;
      }
      notifications.show({
        color: aviso ? 'yellow' : 'green',
        title: `Divergência ${d!.protocolo} cadastrada`,
        message: `Encaminhada para ${d!.responsavelAtual?.nome} (${d!.setor.nome}).${aviso}`,
      });
      navigate(`/divergencias/${d!.id}`);
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? { mensagem: e.message, detalhes: e.detalhes }
          : { mensagem: 'Não foi possível cadastrar' },
      );
    } finally {
      setEnviando(false);
    }
  });

  return (
    <>
      <Cabecalho
        sobretitulo="Cadastro fiscal"
        titulo="Nova divergência de nota fiscal"
        descricao="Registre os campos essenciais da NF-e e encaminhe a correção para o setor responsável."
        acoes={
          <Button variant="default" onClick={() => navigate('/divergencias')}>
            Voltar à lista
          </Button>
        }
      />
      <Card withBorder mb="lg" visibleFrom="sm">
        <Stepper active={preenchidos} size="sm" color="itaxRed" allowNextStepsSelect={false}>
          <Stepper.Step label="Identificar nota" />
          <Stepper.Step label="Registrar divergência" />
          <Stepper.Step label="Designar responsável" />
          <Stepper.Step label="Encaminhar" />
        </Stepper>
      </Card>
      <form onSubmit={enviar}>
        <Card withBorder p="lg">
          <Stack gap="xl">
            <div>
              <TituloSecao>01 / Dados da nota fiscal</TituloSecao>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <TextInput
                  label="Número da NF"
                  placeholder="Ex.: 000125"
                  withAsterisk
                  inputMode="numeric"
                  {...form.getInputProps('numero')}
                />
                <TextInput
                  label="Série"
                  placeholder="1"
                  withAsterisk
                  inputMode="numeric"
                  {...form.getInputProps('serie')}
                />
                <TextInput
                  label="Chave de acesso NF-e (44 dígitos)"
                  placeholder="Informe a chave de acesso da NF-e"
                  inputMode="numeric"
                  maxLength={54}
                  style={{ gridColumn: 'span 2' }}
                  {...form.getInputProps('chaveAcesso')}
                />
                <TextInput
                  label="Razão social do fornecedor"
                  placeholder="Nome do fornecedor"
                  withAsterisk
                  style={{ gridColumn: 'span 2' }}
                  {...form.getInputProps('emitenteNome')}
                />
                <TextInput
                  label="CNPJ emissor"
                  placeholder="00.000.000/0000-00"
                  withAsterisk
                  {...form.getInputProps('emitenteCnpj')}
                  onChange={(e) => form.setFieldValue('emitenteCnpj', mascararCnpj(e.currentTarget.value))}
                />
                <NumberInput
                  label="Valor total da NF (R$)"
                  placeholder="0,00"
                  withAsterisk
                  decimalSeparator=","
                  thousandSeparator="."
                  decimalScale={2}
                  fixedDecimalScale
                  min={0}
                  hideControls
                  {...form.getInputProps('valorTotal')}
                />
                <DateInput
                  label="Data de emissão"
                  valueFormat="DD/MM/YYYY"
                  clearable
                  maxDate={new Date()}
                  {...form.getInputProps('dataEmissao')}
                />
                <TextInput
                  label="Pedido de compra (OC)"
                  placeholder="Nº da ordem de compra"
                  {...form.getInputProps('pedidoCompra')}
                />
                <Select
                  label="Unidade / obra"
                  placeholder="Selecione"
                  data={UNIDADES}
                  clearable
                  {...form.getInputProps('unidade')}
                />
                <TextInput
                  label="Centro de custo"
                  placeholder="Ex.: 26.30"
                  {...form.getInputProps('centroCusto')}
                />
              </SimpleGrid>
            </div>

            <div>
              <TituloSecao>02 / Divergência e encaminhamento</TituloSecao>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <Select
                  label="Tipo de divergência"
                  withAsterisk
                  searchable
                  style={{ gridColumn: 'span 2' }}
                  data={cadastros.tipos.map((t) => ({ value: String(t.id), label: t.nome }))}
                  {...form.getInputProps('tipoId')}
                  onChange={(v) => {
                    form.setFieldValue('tipoId', v);
                    const tipo = cadastros.tipos.find((t) => String(t.id) === v);
                    if (tipo?.setorOrigemId && !form.values.setorId) {
                      form.setFieldValue('setorId', String(tipo.setorOrigemId));
                      form.setFieldValue('responsavelId', null);
                    }
                  }}
                />
                <Select
                  label="Setor responsável"
                  withAsterisk
                  data={cadastros.setores.map((s) => ({ value: String(s.id), label: s.nome }))}
                  {...form.getInputProps('setorId')}
                  onChange={(v) => {
                    form.setFieldValue('setorId', v);
                    form.setFieldValue('responsavelId', null);
                  }}
                />
                <Select
                  label="Responsável"
                  withAsterisk
                  searchable
                  placeholder={setorId ? 'Selecione' : 'Escolha o setor primeiro'}
                  data={responsaveis}
                  nothingFoundMessage="Nenhum usuário ativo neste setor"
                  {...form.getInputProps('responsavelId')}
                />
                <Select
                  label="Prioridade"
                  data={Object.entries(ROTULO_PRIORIDADE).map(([value, label]) => ({ value, label }))}
                  allowDeselect={false}
                  {...form.getInputProps('prioridade')}
                />
                <DateInput
                  label="Prazo para correção"
                  valueFormat="DD/MM/YYYY"
                  placeholder="SLA do setor"
                  description="Sem data, usa o SLA do setor"
                  minDate={new Date()}
                  clearable
                  {...form.getInputProps('prazo')}
                />
                <FileInput
                  label="Documento de apoio"
                  placeholder="XML, PDF ou imagem"
                  description="Até 5 arquivos de 10 MB"
                  multiple
                  clearable
                  accept=".xml,.pdf,.jpg,.jpeg,.png"
                  leftSection={<IconPaperclip size={16} />}
                  style={{ gridColumn: 'span 2' }}
                  {...form.getInputProps('anexos')}
                />
                <TextInput
                  label="Valor / quantidade na NF"
                  placeholder="Ex.: 12 un ou R$ 15.000,00"
                  {...form.getInputProps('valorNf')}
                />
                <TextInput
                  label="Valor / quantidade esperado"
                  placeholder="Ex.: 10 un ou R$ 14.200,00"
                  {...form.getInputProps('valorEsperado')}
                />
                <TextInput
                  label="Correção esperada"
                  placeholder="Ex.: ajustar o pedido para 12 unidades"
                  style={{ gridColumn: 'span 2' }}
                  {...form.getInputProps('correcaoEsperada')}
                />
                <Textarea
                  label="Descrição e providência solicitada"
                  withAsterisk
                  autosize
                  minRows={3}
                  placeholder="Descreva o que está diferente e qual ajuste deve ser realizado no pedido, cadastro ou lançamento."
                  style={{ gridColumn: '1 / -1' }}
                  {...form.getInputProps('descricao')}
                />
              </SimpleGrid>
            </div>

            {erro && (
              <Alert color="itaxRed" title={erro.mensagem}>
                {erro.detalhes?.join('; ')}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate('/divergencias')}>
                Cancelar
              </Button>
              <Button type="submit" loading={enviando} leftSection={<IconSend size={16} />}>
                Cadastrar e enviar para o setor
              </Button>
            </Group>
          </Stack>
        </Card>
      </form>
    </>
  );
}
