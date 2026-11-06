import { describe, expect, it } from 'vitest';
import { formatarChave, formatarCnpj, formatarData, formatarDuracao, formatarMoeda } from './formato';

describe('formatação no padrão brasileiro', () => {
  it('data em DD/MM/AAAA', () => expect(formatarData('2026-11-06T12:00:00')).toBe('06/11/2026'));
  it('valor em reais', () => expect(formatarMoeda('1530.75')).toBe('R$ 1.530,75'));
  it('CNPJ com máscara', () => expect(formatarCnpj('12345678000190')).toBe('12.345.678/0001-90'));
  it('chave em blocos', () =>
    expect(formatarChave('35261112345678000190550010000012341000012345')).toBe(
      '3526 1112 3456 7800 0190 5500 1000 0012 3410 0001 2345',
    ));
  it('duração legível', () => {
    expect(formatarDuracao(0.5)).toBe('30 min');
    expect(formatarDuracao(5.5)).toBe('5,5 h');
    expect(formatarDuracao(52)).toBe('2 d 4 h');
    expect(formatarDuracao(48)).toBe('2 d');
    expect(formatarDuracao(null)).toBe('—');
  });
});
