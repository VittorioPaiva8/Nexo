import { describe, expect, it } from 'vitest';
import { chaveValida, cnpjValido, mascararCnpj } from './documentos';

describe('documentos', () => {
  it('valida CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
  });
  it('valida chave de acesso', () => {
    const base = '4126111122233300018155001000000125100000125';
    expect(Array.from({ length: 10 }, (_, i) => base + i).filter(chaveValida)).toHaveLength(1);
  });
  it('máscara de CNPJ', () => {
    expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascararCnpj('11222')).toBe('11.222');
  });
});
