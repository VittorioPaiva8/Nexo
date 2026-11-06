import { describe, expect, it } from 'vitest';
import { chaveAcessoValida, cnpjValido, formatarCnpj, lerValor, normalizarNome } from './documentos.js';
import { fimDoPrazo, hojeBrasilia, lerDia, somarDias, dataDoDia } from './datas.js';

describe('documentos', () => {
  it('valida CNPJ pelos dígitos verificadores', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
  });

  it('valida a chave de acesso pelo módulo 11', () => {
    expect(chaveAcessoValida('35261111222333000181550010000001251000001250')).toBe(false);
    const base = '3526111122233300018155001000000125100000125';
    const dvs = Array.from({ length: 10 }, (_, i) => base + i).filter(chaveAcessoValida);
    expect(dvs).toHaveLength(1);
    expect(chaveAcessoValida('123')).toBe(false);
  });

  it('lê valores em formato brasileiro', () => {
    expect(lerValor('10.500,00')).toBe('10500.00');
    expect(lerValor('R$ 4.320,5')).toBe('4320.50');
    expect(lerValor('99.9')).toBe('99.90');
    expect(lerValor('abc')).toBeNull();
    expect(lerValor('0')).toBeNull();
  });

  it('formata CNPJ e normaliza nomes', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(normalizarNome('  Logística   Reversa ')).toBe('logistica reversa');
  });
});

describe('datas', () => {
  it('trata o prazo como dia de Brasília', () => {
    expect(hojeBrasilia(new Date('2026-11-06T02:00:00Z'))).toBe('2026-11-05');
    expect(somarDias('2026-11-30', 2)).toBe('2026-12-02');
    expect(fimDoPrazo(dataDoDia('2026-11-06')).toISOString()).toBe('2026-11-07T02:59:59.999Z');
  });

  it('lê datas ISO e brasileiras', () => {
    expect(lerDia('07/11/2026')).toBe('2026-11-07');
    expect(lerDia('2026-11-07')).toBe('2026-11-07');
    expect(lerDia('31/02/2026')).toBeNull();
    expect(lerDia('amanhã')).toBeNull();
  });
});
