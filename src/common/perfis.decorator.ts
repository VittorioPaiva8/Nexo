import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '../generated/prisma/enums.js';

export const PERFIS_KEY = 'perfis';
/** Restringe o endpoint aos perfis informados (verificado no backend pelo PerfisGuard). */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS_KEY, perfis);

export const PUBLICO_KEY = 'publico';
/** Libera o endpoint sem autenticação (ex.: login). */
export const Publico = () => SetMetadata(PUBLICO_KEY, true);
