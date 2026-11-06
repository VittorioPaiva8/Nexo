/**
 * Substituto mínimo do @nestjs/common para o Worker do Cloudflare.
 * Os services do Nexo usam só os decorators de injeção (que viram no-op aqui) e as exceções HTTP.
 * No Worker não há injeção de dependências: os services são criados à mão em cloudflare/api.ts.
 */
const semEfeito =
  () =>
  (..._alvo: unknown[]): void => {};

export const Injectable = semEfeito;
export const Global = semEfeito;
export const Module = semEfeito;

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export class HttpException extends Error {
  constructor(
    private readonly resposta: string | Record<string, unknown>,
    private readonly status: number,
  ) {
    super(typeof resposta === 'string' ? resposta : String(resposta['message'] ?? 'Erro'));
  }
  getStatus(): number {
    return this.status;
  }
  getResponse(): string | Record<string, unknown> {
    return this.resposta;
  }
}

function excecao(status: number, padrao: string) {
  return class extends HttpException {
    constructor(mensagem: string | string[] = padrao) {
      super({ message: mensagem, statusCode: status }, status);
    }
  };
}

export const BadRequestException = excecao(400, 'Bad Request');
export const UnauthorizedException = excecao(401, 'Unauthorized');
export const ForbiddenException = excecao(403, 'Forbidden');
export const NotFoundException = excecao(404, 'Not Found');
export const ConflictException = excecao(409, 'Conflict');
export const PayloadTooLargeException = excecao(413, 'Payload Too Large');

export class Logger {
  constructor(private readonly contexto = 'Nexo') {}
  log(...m: unknown[]) {
    console.log(`[${this.contexto}]`, ...m);
  }
  warn(...m: unknown[]) {
    console.warn(`[${this.contexto}]`, ...m);
  }
  error(...m: unknown[]) {
    console.error(`[${this.contexto}]`, ...m);
  }
  static log(...m: unknown[]) {
    console.log(...m);
  }
}
