export type Perfil = 'FISCAL' | 'TRATADOR' | 'GESTOR' | 'ADMIN';
export type StatusNota = 'SEM_PENDENCIA' | 'EM_AJUSTE' | 'AJUSTADA';
export type OrigemNota = 'XML' | 'MANUAL' | 'CSV';
export type StatusDivergencia = 'PENDENTE' | 'EM_TRATAMENTO' | 'DEVOLVIDA' | 'CONCLUIDA';
export type Prioridade = 'NORMAL' | 'ALTA' | 'CRITICA';
export type AcaoMovimentacao =
  'CADASTRO' | 'ASSUNCAO' | 'DEVOLUCAO' | 'CONCLUSAO' | 'REABERTURA' | 'REDISTRIBUICAO';
export type EventoNotificacao = 'NOVA_ATRIBUICAO' | 'DEVOLUCAO' | 'PRAZO_PROXIMO' | 'ESCALONAMENTO';

export interface Setor {
  id: number;
  nome: string;
  descricao: string | null;
  slaDias: number;
  ativo: boolean;
  _count?: { usuarios: number };
}

export interface TipoDivergencia {
  id: number;
  nome: string;
  ativo: boolean;
  setorOrigemId: number | null;
  setorOrigem?: { id: number; nome: string } | null;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  setorId: number | null;
  setor?: Setor | null;
}

export interface UsuarioResumo {
  id: number;
  nome: string;
  email?: string;
  setorId?: number | null;
}

export interface NotaFiscal {
  id: number;
  chaveAcesso: string | null;
  numero: string;
  serie: string;
  modelo: string | null;
  dataEmissao: string | null;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioDoc: string | null;
  destinatarioNome: string | null;
  valorTotal: string;
  naturezaOperacao: string | null;
  pedidoCompra: string | null;
  unidade: string | null;
  centroCusto: string | null;
  origem: OrigemNota;
  status: StatusNota;
  importacaoId: number | null;
  criadaEm: string;
  divergenciasAbertas?: number;
}

export interface ResultadoImportacaoXml {
  importacao: {
    id: number;
    totalArquivos: number;
    totalImportadas: number;
    totalDuplicadas: number;
    totalInvalidas: number;
  };
  notas: NotaFiscal[];
  duplicadas: { arquivo: string; chaveAcesso: string }[];
  erros: { arquivo: string; motivo: string }[];
}

export interface LinhaLote {
  linha: number;
  numeroNf: string;
  serie: string;
  fornecedor: string;
  cnpj: string;
  valorTotal: string | null;
  tipo: string;
  setor: string;
  responsavel: string;
  prazo: string | null;
  situacao: 'VALIDA' | 'DUPLICADA' | 'INVALIDA';
  erros: string[];
  protocolo?: string;
}

export interface RelatorioLote {
  totalLinhas: number;
  validas: number;
  duplicadas: number;
  invalidas: number;
  linhas: LinhaLote[];
  importacao?: { id: number };
}

export interface Divergencia {
  id: number;
  protocolo: string;
  notaFiscalId: number;
  notaFiscal: Pick<
    NotaFiscal,
    | 'id'
    | 'numero'
    | 'serie'
    | 'chaveAcesso'
    | 'emitenteNome'
    | 'emitenteCnpj'
    | 'valorTotal'
    | 'dataEmissao'
    | 'pedidoCompra'
  > &
    Partial<NotaFiscal>;
  tipo: { id: number; nome: string };
  setor: { id: number; nome: string };
  descricao: string;
  valorNf: string | null;
  valorEsperado: string | null;
  correcaoEsperada: string | null;
  prioridade: Prioridade;
  prazo: string;
  status: StatusDivergencia;
  atrasada: boolean;
  solicitante: UsuarioResumo;
  responsavelAtual: UsuarioResumo | null;
  devolutiva: string | null;
  tipoSolucao: string | null;
  rascunho: string | null;
  parecer: string | null;
  reaberturas: number;
  abertaEm: string;
  devolvidaEm: string | null;
  concluidaEm: string | null;
  horasAberta: number;
  horasComResponsavelAtual: number | null;
}

export interface AnexoResumo {
  id: number;
  categoria: 'APOIO' | 'EVIDENCIA';
  nomeArquivo: string;
  tipoConteudo: string;
  tamanho: number;
  sha256: string;
  criadoEm: string;
  usuario: { id: number; nome: string };
}

export interface Movimentacao {
  id: number;
  acao: AcaoMovimentacao;
  statusAnterior: StatusDivergencia | null;
  statusNovo: StatusDivergencia;
  texto: string;
  criadaEm: string;
  setorDestino: string | null;
  prazoAnterior: string | null;
  prazoNovo: string | null;
  autor: UsuarioResumo;
  destino: UsuarioResumo | null;
  anexos: { id: number; nomeArquivo: string; tamanho: number }[];
}

export interface Atribuicao {
  id: number;
  inicio: string;
  fim: string | null;
  motivoFim: 'DEVOLVIDA' | 'REDISTRIBUIDA' | null;
  horas: number;
  responsavel: { id: number; nome: string };
  setor: Setor | null;
}

export interface DivergenciaDetalhe extends Divergencia {
  prazoOriginal: string;
  movimentacoes: Movimentacao[];
  anexos: AnexoResumo[];
  atribuicoes: Atribuicao[];
}

export interface Contadores {
  pendentes: number;
  devolvidas: number;
  atrasadas: number;
  minhas: number;
  vencendo: number;
  resolvidasSemana: number;
}

export interface Pagina<T> {
  data: T[];
  meta: { pagina: number; porPagina: number; total: number };
}

export interface LinhaTempo {
  id: number | null;
  nome: string;
  horasTotais: number;
  horasMedias: number;
  passagens: number;
  pendentesAgora: number;
}

export interface Relatorio {
  resumo: {
    total: number;
    abertas: number;
    pendentes: number;
    emTratamento: number;
    aguardandoValidacao: number;
    concluidas: number;
    atrasadas: number;
    taxaSla: number | null;
    diasMediosResolucao: number;
    diasMediosAbertas: number;
    taxaReabertura: number | null;
    responsaveisAtribuidos: number | null;
  };
  porSetor: {
    id: number;
    nome: string;
    total: number;
    abertas: number;
    atrasadas: number;
    taxaSla: number | null;
    horasTotais: number;
    horasMedias: number;
    passagens: number;
  }[];
  tempoPorSetor: LinhaTempo[];
  porResponsavel: LinhaTempo[];
  faixasIdade: { faixa: string; quantidade: number }[];
  porTipo: { tipo: string; quantidade: number }[];
  porFornecedor: { cnpj: string; nome: string; quantidade: number; principalMotivo: string }[];
}

export interface PainelGeral {
  kpis: {
    abertas: number;
    cadastradasHoje: number;
    emTratamento: number;
    aguardandoValidacao: number;
    concluidasMes: number;
    noPrazoMes: number | null;
  };
  atencao: {
    id: number;
    protocolo: string;
    status: StatusDivergencia;
    prioridade: Prioridade;
    prazo: string;
    atrasada: boolean;
    numeroNf: string;
    fornecedor: string;
    tipo: string;
    setor: string;
    responsavel: string | null;
  }[];
  volumePorDia: { dia: string; quantidade: number }[];
  principaisOrigens: { tipo: string; quantidade: number; percentual: number }[];
  sla: {
    diasMediosResolucao: number;
    vencidas: number;
    responsaveisAtribuidos: number | null;
    taxaReabertura: number | null;
  };
}

export interface Notificacao {
  id: number;
  evento: EventoNotificacao;
  assunto: string;
  situacao: 'NAO_ENVIADA' | 'ENVIADA' | 'FALHA';
  criadaEm: string;
  lidaEm: string | null;
  divergenciaId: number | null;
}

export interface ConfigAviso {
  evento: EventoNotificacao;
  titulo: string;
  descricao: string;
  ativo: boolean;
}
