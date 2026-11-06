import { describe, expect, it } from 'vitest';
import { horasEntre, proximoStatus, RegraViolada, statusDaNota, type ContextoAcao } from './regras.js';

const base: ContextoAcao = {
  status: 'PENDENTE',
  usuarioId: 2,
  perfil: 'RESPONSAVEL',
  solicitanteId: 1,
  responsavelAtualId: 2,
};

describe('proximoStatus', () => {
  it('responsável responde: vai para aguardando revisão', () => {
    expect(proximoStatus('responder', base)).toBe('AGUARDANDO_REVISAO');
  });

  it('outro usuário não pode responder', () => {
    expect(() => proximoStatus('responder', { ...base, usuarioId: 3 })).toThrow(RegraViolada);
  });

  it('não responde duas vezes', () => {
    expect(() => proximoStatus('responder', { ...base, status: 'AGUARDANDO_REVISAO' })).toThrow(
      /aguardando revisão/,
    );
  });

  it('responsável e solicitante podem repassar; terceiros não', () => {
    expect(proximoStatus('repassar', base)).toBe('PENDENTE');
    expect(proximoStatus('repassar', { ...base, usuarioId: 1, perfil: 'REVISOR' })).toBe('PENDENTE');
    expect(() => proximoStatus('repassar', { ...base, usuarioId: 9 })).toThrow(RegraViolada);
  });

  it('solicitante aceita ou devolve depois da resposta', () => {
    const ctx: ContextoAcao = { ...base, status: 'AGUARDANDO_REVISAO', usuarioId: 1, perfil: 'REVISOR' };
    expect(proximoStatus('aceitar', ctx)).toBe('RESOLVIDA');
    expect(proximoStatus('devolver', ctx)).toBe('PENDENTE');
  });

  it('admin pode aceitar mesmo sem ser o solicitante', () => {
    expect(
      proximoStatus('aceitar', { ...base, status: 'AGUARDANDO_REVISAO', usuarioId: 7, perfil: 'ADMIN' }),
    ).toBe('RESOLVIDA');
  });

  it('responsável não pode aceitar a própria resposta', () => {
    const erro = (() => {
      try {
        proximoStatus('aceitar', { ...base, status: 'AGUARDANDO_REVISAO' });
      } catch (e) {
        return e as RegraViolada;
      }
    })();
    expect(erro?.tipo).toBe('permissao');
  });

  it('nada acontece numa divergência resolvida', () => {
    for (const acao of ['responder', 'repassar', 'aceitar', 'devolver'] as const) {
      expect(() => proximoStatus(acao, { ...base, status: 'RESOLVIDA', perfil: 'ADMIN' })).toThrow(
        /resolvida/,
      );
    }
  });
});

describe('statusDaNota', () => {
  it('sem divergências continua importada', () => expect(statusDaNota([])).toBe('IMPORTADA'));
  it('com alguma aberta fica em ajuste', () =>
    expect(statusDaNota(['RESOLVIDA', 'PENDENTE'])).toBe('EM_AJUSTE'));
  it('todas resolvidas fica ajustada', () =>
    expect(statusDaNota(['RESOLVIDA', 'RESOLVIDA'])).toBe('AJUSTADA'));
});

describe('horasEntre', () => {
  const agora = new Date('2026-11-06T12:00:00Z');
  it('usa o fim quando existe', () =>
    expect(horasEntre(new Date('2026-11-06T09:30:00Z'), new Date('2026-11-06T11:00:00Z'), agora)).toBe(1.5));
  it('conta até agora quando está em aberto', () =>
    expect(horasEntre(new Date('2026-11-05T12:00:00Z'), null, agora)).toBe(24));
});
