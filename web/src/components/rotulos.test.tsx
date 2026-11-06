import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme } from '../theme';
import { BadgeDivergencia, corDoTempo } from './rotulos';

describe('rótulos de status', () => {
  it('mostra a situação da divergência em português', () => {
    render(
      <MantineProvider theme={theme}>
        <BadgeDivergencia status="AGUARDANDO_REVISAO" />
      </MantineProvider>,
    );
    expect(screen.getByText('Aguardando revisão')).toBeInTheDocument();
  });

  it('destaca em vermelho só o que está parado há mais de 3 dias', () => {
    expect(corDoTempo(5)).toBe('gray');
    expect(corDoTempo(30)).toBe('yellow');
    expect(corDoTempo(80)).toBe('itaxRed');
  });
});
