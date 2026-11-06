import { XMLParser } from 'fast-xml-parser';

export interface DadosNfe {
  chaveAcesso: string;
  numero: string;
  serie: string;
  modelo: string;
  dataEmissao: Date;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioDoc: string | null;
  destinatarioNome: string | null;
  valorTotal: string;
  naturezaOperacao: string | null;
}

export class ErroLeituraNfe extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

type No = Record<string, unknown>;

function texto(no: unknown, campo: string): string | null {
  if (!no || typeof no !== 'object') return null;
  const valor = (no as No)[campo];
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'object') {
    const t = (valor as No)['#text'];
    return t === undefined ? null : String(t);
  }
  return String(valor);
}

function obrigatorio(no: unknown, campo: string, rotulo: string): string {
  const valor = texto(no, campo);
  if (!valor) throw new ErroLeituraNfe(`Campo obrigatório ausente no XML: ${rotulo}`);
  return valor;
}

/**
 * Lê o XML de uma NF-e (modelo 55/65), com ou sem o envelope nfeProc,
 * e devolve os dados usados no controle de divergências.
 */
export function lerXmlNfe(xml: string): DadosNfe {
  let raiz: No;
  try {
    raiz = parser.parse(xml) as No;
  } catch {
    throw new ErroLeituraNfe('Arquivo não é um XML válido');
  }

  const proc = (raiz['nfeProc'] as No | undefined) ?? raiz;
  const nfe = proc['NFe'] as No | undefined;
  const inf = nfe?.['infNFe'] as No | undefined;
  if (!inf) throw new ErroLeituraNfe('XML não contém uma NF-e (infNFe não encontrado)');

  const ide = inf['ide'];
  const emit = inf['emit'];
  const dest = inf['dest'];
  const icmsTot = (inf['total'] as No | undefined)?.['ICMSTot'];

  const idAttr = texto(inf, '@Id') ?? '';
  const chaveProt = texto(
    ((proc['protNFe'] as No | undefined)?.['infProt'] as No | undefined) ?? {},
    'chNFe',
  );
  const chaveAcesso = (chaveProt ?? idAttr.replace(/^NFe/, '')).replace(/\D/g, '');
  if (chaveAcesso.length !== 44) throw new ErroLeituraNfe('Chave de acesso inválida (esperados 44 dígitos)');

  const dataTexto = texto(ide, 'dhEmi') ?? texto(ide, 'dEmi');
  if (!dataTexto) throw new ErroLeituraNfe('Campo obrigatório ausente no XML: data de emissão');
  const dataEmissao = new Date(dataTexto.length === 10 ? `${dataTexto}T00:00:00-03:00` : dataTexto);
  if (Number.isNaN(dataEmissao.getTime())) throw new ErroLeituraNfe('Data de emissão inválida');

  const valorTotal = obrigatorio(icmsTot, 'vNF', 'valor total (vNF)');
  if (!/^\d+(\.\d{1,2})?$/.test(valorTotal)) throw new ErroLeituraNfe('Valor total (vNF) inválido');

  const emitenteCnpj = texto(emit, 'CNPJ') ?? texto(emit, 'CPF');
  if (!emitenteCnpj) throw new ErroLeituraNfe('Campo obrigatório ausente no XML: CNPJ do emitente');

  return {
    chaveAcesso,
    numero: obrigatorio(ide, 'nNF', 'número (nNF)'),
    serie: obrigatorio(ide, 'serie', 'série'),
    modelo: texto(ide, 'mod') ?? '55',
    dataEmissao,
    emitenteCnpj,
    emitenteNome: obrigatorio(emit, 'xNome', 'nome do emitente'),
    destinatarioDoc: texto(dest, 'CNPJ') ?? texto(dest, 'CPF'),
    destinatarioNome: texto(dest, 'xNome'),
    valorTotal,
    naturezaOperacao: texto(ide, 'natOp'),
  };
}
