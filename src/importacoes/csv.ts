/** Leitor de CSV separado por ponto e vírgula (padrão do Excel em pt-BR), com suporte a aspas. */
export function lerCsv(texto: string, separador = ';'): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((v) => v.trim())).filter((l) => l.some((v) => v !== ''));
}

export const COLUNAS_OBRIGATORIAS = [
  'numero_nf',
  'serie',
  'cnpj_emissor',
  'fornecedor',
  'valor_total',
  'tipo_divergencia',
  'setor',
  'responsavel',
  'descricao',
] as const;

export const COLUNAS_OPCIONAIS = [
  'chave_acesso',
  'data_emissao',
  'pedido_compra',
  'centro_custo',
  'unidade',
  'prioridade',
  'prazo',
] as const;

export type ColunaCsv = (typeof COLUNAS_OBRIGATORIAS)[number] | (typeof COLUNAS_OPCIONAIS)[number];
