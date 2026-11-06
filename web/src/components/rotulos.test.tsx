import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BadgeDivergencia, BadgePrioridade, corDoTempo } from './rotulos';

describe('rótulos', () => {
  it('mostra o status e o atraso', () => {
    render(
      <MantineProvider>
        <BadgeDivergencia status="DEVOLVIDA" atrasada />
        <BadgePrioridade prioridade="CRITICA" />
        <BadgePrioridade prioridade="NORMAL" />
      </MantineProvider>,
    );
    expect(screen.getByText('Devolvida ao Fiscal')).toBeInTheDocument();
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
    expect(screen.getByText('Crítica')).toBeInTheDocument();
    expect(screen.queryByText('Normal')).toBeNull();
  });

  it('cor do tempo parado', () => {
    expect(corDoTempo(2)).toBe('gray');
    expect(corDoTempo(30)).toBe('yellow');
    expect(corDoTempo(100)).toBe('itaxRed');
  });
});
