export type Perfil = 'ADMIN' | 'REVISOR' | 'RESPONSAVEL';
export type StatusNota = 'IMPORTADA' | 'EM_AJUSTE' | 'AJUSTADA';
export type StatusDivergencia = 'PENDENTE' | 'AGUARDANDO_REVISAO' | 'RESOLVIDA';
export type TipoMensagem = 'SOLICITACAO' | 'JUSTIFICATIVA' | 'CORRECAO' | 'REPASSE' | 'DEVOLUCAO' | 'ACEITE';

export interface Setor {
  id: number;
  nome: string;
  ativo: boolean;
}

export interface TipoDivergencia {
  id: number;
  nome: string;
  ativo: boolean;
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
  setor?: { id: number; nome: string } | null;
}

export interface NotaFiscal {
  id: number;
  chaveAcesso: string;
  numero: string;
  serie: string;
  modelo: string;
  dataEmissao: string;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioDoc: string | null;
  destinatarioNome: string | null;
  valorTotal: string;
  naturezaOperacao: string | null;
  status: StatusNota;
  importacaoId: number;
  criadaEm: string;
  divergenciasAbertas?: number;
}

export interface ResultadoImportacao {
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

export interface Divergencia {
  id: number;
  notaFiscalId: number;
  notaFiscal: Pick<NotaFiscal, 'id' | 'numero' | 'serie' | 'chaveAcesso' | 'emitenteNome' | 'valorTotal'> &
    Partial<Pick<NotaFiscal, 'emitenteCnpj' | 'dataEmissao' | 'status'>>;
  tipo: TipoDivergencia;
  descricao: string;
  status: StatusDivergencia;
  solicitante: UsuarioResumo;
  responsavelAtual: UsuarioResumo | null;
  abertaEm: string;
  resolvidaEm: string | null;
  horasAberta: number;
  horasComResponsavelAtual: number | null;
}

export interface Mensagem {
  id: number;
  tipo: TipoMensagem;
  texto: string;
  criadaEm: string;
  autor: UsuarioResumo;
}

export interface Atribuicao {
  id: number;
  inicio: string;
  fim: string | null;
  motivoFim: 'RESPONDIDA' | 'REPASSADA' | null;
  horas: number;
  responsavel: { id: number; nome: string };
  setor: Setor | null;
}

export interface DivergenciaDetalhe extends Divergencia {
  mensagens: Mensagem[];
  atribuicoes: Atribuicao[];
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

export interface Metricas {
  resumo: {
    total: number;
    abertas: number;
    pendentesComResponsavel: number;
    aguardandoRevisao: number;
    resolvidas: number;
    horasMediasAbertas: number;
    horasMediasResolucao: number;
    taxaReabertura: number;
  };
  porSetor: LinhaTempo[];
  porResponsavel: LinhaTempo[];
  faixasIdade: { faixa: string; quantidade: number }[];
  porTipo: { tipo: string; quantidade: number }[];
}
