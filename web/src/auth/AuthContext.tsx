import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, registrarAoExpirar, tokenArmazenado } from '../api/cliente';
import type { Perfil, Usuario } from '../api/tipos';

interface ValorAuth {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  temPerfil: (...perfis: Perfil[]) => boolean;
}

const Contexto = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(Boolean(tokenArmazenado.ler()));

  const sair = useCallback(() => {
    tokenArmazenado.apagar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    registrarAoExpirar(sair);
    if (!tokenArmazenado.ler()) return;
    api
      .get<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(sair)
      .finally(() => setCarregando(false));
  }, [sair]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha });
    tokenArmazenado.gravar(r.token);
    setUsuario(r.usuario);
  }, []);

  const valor = useMemo<ValorAuth>(
    () => ({
      usuario,
      carregando,
      entrar,
      sair,
      temPerfil: (...perfis) => Boolean(usuario && perfis.includes(usuario.perfil)),
    }),
    [usuario, carregando, entrar, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ValorAuth {
  const v = useContext(Contexto);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
