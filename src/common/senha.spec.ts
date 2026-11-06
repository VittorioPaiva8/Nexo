import { describe, expect, it } from 'vitest';
import { conferirSenha, gerarHashSenha } from './senha.js';

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await gerarHashSenha('nexo123', 1000);
    expect(hash.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await conferirSenha('nexo123', hash)).toBe(true);
    expect(await conferirSenha('nexo124', hash)).toBe(false);
  });

  it('gera sal diferente a cada hash e recusa formatos desconhecidos', async () => {
    expect(await gerarHashSenha('a', 1000)).not.toBe(await gerarHashSenha('a', 1000));
    expect(await conferirSenha('nexo123', '$2b$10$abc')).toBe(false);
  });
});
