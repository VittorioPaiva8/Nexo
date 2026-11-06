/** Substituto do @nestjs/swagger no Worker: os decorators dos DTOs só documentam, então viram no-op. */
const semEfeito =
  (..._args: unknown[]) =>
  (..._alvo: unknown[]): void => {};

export const ApiProperty = semEfeito;
export const ApiPropertyOptional = semEfeito;
export const ApiHideProperty = semEfeito;
