import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Tema do Nexo seguindo o manual ITAX-ID-001:
 * vermelho Itax #E40B18 como cor de ação, Plus Jakarta Sans, cantos de 12px,
 * área de trabalho clara e cabeçalho escuro (#1A1A1A).
 */
const itaxRed: MantineColorsTuple = [
  '#ffe9ea',
  '#ffd1d3',
  '#fca1a5',
  '#f86c73',
  '#f4404a',
  '#f2252f',
  '#e40b18', // 6 — Vermelho Itax (cor primária)
  '#c80513',
  '#a3040f', // 8
  '#79060e', // 9 — Vermelho escuro
];

export const CORES_ITAX = {
  preto: '#000000',
  pretoSuave: '#0D0D0D',
  chumbo: '#1A1A1A',
  cinzaEscuro: '#404040',
  cinzaMedio: '#808080',
  cinzaClaro: '#BFBFBF',
  cinzaNeutroClaro: '#D9D9D9',
  cinzaMuitoClaro: '#E6E6E6',
  vermelho: '#E40B18',
  vermelhoEscuro: '#79060E',
} as const;

export const theme = createTheme({
  primaryColor: 'itaxRed',
  primaryShade: 6,
  colors: { itaxRed },
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
  radius: { md: '12px', lg: '16px' },
  black: CORES_ITAX.chumbo,
  components: {
    Button: { defaultProps: { radius: 'md' }, styles: { root: { fontWeight: 600 } } },
    Badge: { styles: { root: { fontWeight: 600 } } },
    Card: { defaultProps: { radius: 'md', withBorder: true } },
    Paper: { defaultProps: { radius: 'md' } },
  },
});
