/** Gera um XML de NF-e mínimo (com nfeProc) para testes e seed. */
export function xmlNfeExemplo(
  opcoes: {
    chave?: string;
    numero?: string;
    valor?: string;
    emitente?: string;
    cnpj?: string;
    data?: string;
  } = {},
): string {
  const chave = opcoes.chave ?? '35261112345678000190550010000012341000012345';
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide>
        <cUF>35</cUF><natOp>Venda de mercadoria</natOp><mod>55</mod>
        <serie>1</serie><nNF>${opcoes.numero ?? '1234'}</nNF>
        <dhEmi>${opcoes.data ?? '2026-11-03T10:15:00-03:00'}</dhEmi>
      </ide>
      <emit>
        <CNPJ>${opcoes.cnpj ?? '12345678000195'}</CNPJ>
        <xNome>${opcoes.emitente ?? 'Fornecedor Exemplo Ltda'}</xNome>
      </emit>
      <dest>
        <CNPJ>98765432000110</CNPJ>
        <xNome>Grupo Itax</xNome>
      </dest>
      <total><ICMSTot><vProd>1500.00</vProd><vNF>${opcoes.valor ?? '1530.75'}</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00"><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe>
</nfeProc>`;
}
