import { useEffect, useState } from 'react';
import { api } from './cliente';
import type { Setor, TipoDivergencia, Usuario } from './tipos';

export interface Cadastros {
  setores: Setor[];
  tipos: TipoDivergencia[];
  usuarios: Usuario[];
}

let cache: Promise<Cadastros> | null = null;

/** Setores, tipos e usuários ativos, carregados uma vez por sessão (usados nos formulários). */
export function useCadastros(): Cadastros | null {
  const [dados, setDados] = useState<Cadastros | null>(null);
  useEffect(() => {
    cache ??= Promise.all([
      api.get<Setor[]>('/setores'),
      api.get<TipoDivergencia[]>('/tipos-divergencia'),
      api.get<Usuario[]>('/usuarios'),
    ]).then(([setores, tipos, usuarios]) => ({
      setores: setores.filter((s) => s.ativo),
      tipos: tipos.filter((t) => t.ativo),
      usuarios,
    }));
    cache.then(setDados).catch(() => {
      cache = null;
    });
  }, []);
  return dados;
}

/** Limpa o cache depois de alterar usuários, setores ou tipos. */
export function invalidarCadastros() {
  cache = null;
}

/** Opções de responsável: do setor escolhido primeiro; outros setores só para quem pode. */
export function opcoesResponsaveis(
  usuarios: Usuario[],
  setorId: number | null,
  incluirOutrosSetores: boolean,
  excluirId?: number | null,
) {
  const lista = usuarios.filter((u) => u.id !== excluirId);
  const doSetor = lista.filter((u) => u.setorId === setorId);
  const grupos = [{ group: 'Do setor', items: doSetor.map((u) => ({ value: String(u.id), label: u.nome })) }];
  if (incluirOutrosSetores) {
    grupos.push({
      group: 'Outros setores',
      items: lista
        .filter((u) => u.setorId !== setorId)
        .map((u) => ({ value: String(u.id), label: `${u.nome} (${u.setor?.nome ?? 'sem setor'})` })),
    });
  }
  return grupos.filter((g) => g.items.length > 0);
}
