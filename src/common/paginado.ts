/** Resultado paginado devolvido pelos services; vira o envelope { data, meta }. */
export class Paginado<T> {
  constructor(
    public readonly itens: T[],
    public readonly meta: { pagina: number; porPagina: number; total: number },
  ) {}
}
