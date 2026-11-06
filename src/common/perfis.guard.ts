import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Perfil } from '../generated/prisma/enums.js';
import { PERFIS_KEY, PUBLICO_KEY } from './perfis.decorator.js';
import type { UsuarioAutenticado } from './usuario-atual.js';

@Injectable()
export class PerfisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const alvos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, alvos)) return true;
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(PERFIS_KEY, alvos);
    if (!perfis || perfis.length === 0) return true;
    const usuario = context.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>().user;
    if (!usuario || !perfis.includes(usuario.perfil)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta ação');
    }
    return true;
  }
}
