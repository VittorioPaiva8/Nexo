import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Converte qualquer erro no envelope padrão ITAX: { error: { status, mensagem, detalhes? } }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const corpo = exception.getResponse();
      let mensagem = exception.message;
      let detalhes: unknown;
      if (typeof corpo === 'object' && corpo !== null) {
        const msg = (corpo as { message?: unknown }).message;
        if (Array.isArray(msg)) {
          mensagem = 'Dados inválidos';
          detalhes = msg;
        } else if (typeof msg === 'string') {
          mensagem = msg;
        }
      }
      if (status === HttpStatus.UNAUTHORIZED && mensagem === 'Unauthorized')
        mensagem = 'Faça login para continuar';
      res.status(status).json({ error: { status, mensagem, ...(detalhes ? { detalhes } : {}) } });
      return;
    }

    this.logger.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { status: HttpStatus.INTERNAL_SERVER_ERROR, mensagem: 'Erro interno do servidor' },
    });
  }
}
