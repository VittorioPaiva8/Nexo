import { describe, expect, it } from 'vitest';
import { xmlNfeExemplo } from '../../test/fixtures/nfe-exemplo.js';
import { ErroLeituraNfe, lerXmlNfe } from './nfe-parser.js';

describe('lerXmlNfe', () => {
  it('lê os dados principais de uma NF-e autorizada (nfeProc)', () => {
    const dados = lerXmlNfe(xmlNfeExemplo());
    expect(dados).toMatchObject({
      chaveAcesso: '35261112345678000190550010000012341000012345',
      numero: '1234',
      serie: '1',
      modelo: '55',
      emitenteCnpj: '12345678000195',
      emitenteNome: 'Fornecedor Exemplo Ltda',
      destinatarioDoc: '98765432000110',
      destinatarioNome: 'Grupo Itax',
      valorTotal: '1530.75',
      naturezaOperacao: 'Venda de mercadoria',
    });
    expect(dados.dataEmissao.toISOString()).toBe('2026-11-03T13:15:00.000Z');
  });

  it('aceita NF-e sem o envelope nfeProc, usando a chave do atributo Id', () => {
    const xml = xmlNfeExemplo()
      .replace(/<nfeProc[^>]*>/, '')
      .replace(/<protNFe[\s\S]*<\/nfeProc>/, '');
    expect(lerXmlNfe(xml).chaveAcesso).toBe('35261112345678000190550010000012341000012345');
  });

  it('rejeita arquivo que não é NF-e', () => {
    expect(() => lerXmlNfe('<pedido><id>1</id></pedido>')).toThrow(ErroLeituraNfe);
  });

  it('rejeita chave de acesso com tamanho errado', () => {
    expect(() => lerXmlNfe(xmlNfeExemplo({ chave: '123' }))).toThrow(/Chave de acesso inválida/);
  });

  it('rejeita NF-e sem valor total', () => {
    expect(() => lerXmlNfe(xmlNfeExemplo().replace(/<vNF>.*<\/vNF>/, ''))).toThrow(/valor total/);
  });
});
