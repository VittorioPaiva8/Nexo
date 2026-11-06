import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Resultado paginado devolvido pelos services; vira o envelope { data, meta }. */
export class Paginado<T> {
  constructor(
    public readonly itens: T[],
    public readonly meta: { pagina: number; porPagina: number; total: number },
  ) {}
}

/** Envolve toda resposta de sucesso no envelope padrão ITAX: { data } ou { data, meta }. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((resultado: unknown) => {
        if (resultado instanceof Paginado) {
          return { data: resultado.itens, meta: resultado.meta };
        }
        return { data: resultado ?? null };
      }),
    );
  }
}
