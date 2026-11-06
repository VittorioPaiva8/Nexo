import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Perfil } from '../generated/prisma/enums.js';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  setorId: number | null;
}

/** Injeta o usuário do token JWT no parâmetro do controller. */
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>().user,
);
