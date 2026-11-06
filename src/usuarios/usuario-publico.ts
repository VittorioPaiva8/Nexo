import type { Setor, Usuario } from '../generated/prisma/client.js';

/** Remove o hash da senha antes de devolver o usuário na API. */
export function usuarioPublico(usuario: Usuario & { setor?: Setor | null }) {
  const { senhaHash: _senhaHash, ...resto } = usuario;
  return resto;
}
