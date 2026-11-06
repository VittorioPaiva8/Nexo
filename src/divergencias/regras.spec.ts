import { describe, expect, it } from 'vitest';
import { estaAtrasada, formatarProtocolo, proximoStatus, RegraViolada, statusDaNota } from './regras.js';

const base = { usuarioId: 10, perfil: 'TRATADOR' as const, responsavelAtualId: 10 };

describe('proximoStatus', () => {
  it('responsável assume e devolve ao Fiscal', () => {
    expect(proximoStatus('assumir', { ...base, status: 'PENDENTE' })).toBe('EM_TRATAMENTO');
    expect(proximoStatus('devolver', { ...base, status: 'EM_TRATAMENTO' })).toBe('DEVOLVIDA');
    expect(proximoStatus('devolver', { ...base, status: 'PENDENTE' })).toBe('DEVOLVIDA');
    expect(proximoStatus('rascunho', { ...base, status: 'EM_TRATAMENTO' })).toBe('EM_TRATAMENTO');
  });

  it('só o responsável designado responde', () => {
    expect(() => proximoStatus('devolver', { ...base, status: 'EM_TRATAMENTO', usuarioId: 11 })).toThrow(
      RegraViolada,
    );
    expect(() =>
      proximoStatus('assumir', { ...base, status: 'PENDENTE', usuarioId: 11, perfil: 'GESTOR' }),
    ).toThrow(/responsável designado/);
  });

  it('conclusão e reabertura são do Fiscal ou gestor, depois da devolução', () => {
    const fiscal = { usuarioId: 1, perfil: 'FISCAL' as const, responsavelAtualId: 10 };
    expect(proximoStatus('concluir', { ...fiscal, status: 'DEVOLVIDA' })).toBe('CONCLUIDA');
    expect(proximoStatus('reabrir', { ...fiscal, status: 'DEVOLVIDA' })).toBe('EM_TRATAMENTO');
    expect(proximoStatus('concluir', { ...fiscal, perfil: 'GESTOR', status: 'DEVOLVIDA' })).toBe('CONCLUIDA');
    expect(() => proximoStatus('concluir', { ...base, status: 'DEVOLVIDA' })).toThrow(/Fiscal ou o gestor/);
    try {
      proximoStatus('concluir', { ...fiscal, status: 'EM_TRATAMENTO' });
    } catch (e) {
      expect((e as RegraViolada).tipo).toBe('estado');
    }
  });

  it('redistribuição só enquanto está com o setor', () => {
    const gestor = { usuarioId: 2, perfil: 'GESTOR' as const, responsavelAtualId: 10 };
    expect(proximoStatus('redistribuir', { ...gestor, status: 'EM_TRATAMENTO' })).toBe('PENDENTE');
    expect(() => proximoStatus('redistribuir', { ...gestor, status: 'CONCLUIDA' })).toThrow(/Concluída/);
    expect(() => proximoStatus('redistribuir', { ...base, status: 'PENDENTE' })).toThrow(RegraViolada);
  });
});

describe('auxiliares', () => {
  it('status da nota acompanha as divergências', () => {
    expect(statusDaNota([])).toBe('SEM_PENDENCIA');
    expect(statusDaNota(['CONCLUIDA', 'DEVOLVIDA'])).toBe('EM_AJUSTE');
    expect(statusDaNota(['CONCLUIDA'])).toBe('AJUSTADA');
  });

  it('atrasada só enquanto está com o setor', () => {
    const prazo = new Date('2026-11-06T02:59:59.999Z');
    const depois = new Date('2026-11-07T12:00:00Z');
    expect(estaAtrasada('EM_TRATAMENTO', prazo, depois)).toBe(true);
    expect(estaAtrasada('DEVOLVIDA', prazo, depois)).toBe(false);
    expect(estaAtrasada('PENDENTE', prazo, new Date('2026-11-05T12:00:00Z'))).toBe(false);
  });

  it('formata o protocolo', () => {
    expect(formatarProtocolo(2026, 148)).toBe('DF-2026-0148');
  });
});
