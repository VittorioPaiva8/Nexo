import { describe, expect, it } from 'vitest';
import { lerCsv } from './csv.js';

describe('lerCsv', () => {
  it('lê ponto e vírgula, BOM, aspas e linhas em branco', () => {
    const texto = '﻿a;b;c\r\n1;"x; y";"diz ""oi"""\n\n2;;3\n';
    expect(lerCsv(texto)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x; y', 'diz "oi"'],
      ['2', '', '3'],
    ]);
  });

  it('aceita quebra de linha dentro de aspas e última linha sem quebra', () => {
    expect(lerCsv('a;b\n"linha 1\nlinha 2";z')).toEqual([
      ['a', 'b'],
      ['linha 1\nlinha 2', 'z'],
    ]);
  });
});
