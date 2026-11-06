import { useCallback, useEffect, useState } from 'react';

/** Carrega dados da API e expõe { dados, carregando, erro, recarregar }. */
export function useApi<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(carregar, deps);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await executar());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
    }
  }, [executar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dados, carregando, erro, recarregar, setDados };
}
