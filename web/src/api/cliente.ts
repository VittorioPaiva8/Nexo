// VITE_API_URL pode ser absoluto (http://localhost:3000) ou relativo ao site (/api, como no Cloudflare).
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CHAVE_TOKEN = 'nexo.token';

export class ErroApi extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detalhes?: string[],
  ) {
    super(message);
  }
}

export const tokenArmazenado = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  gravar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  apagar: () => localStorage.removeItem(CHAVE_TOKEN),
};

let aoExpirar: (() => void) | null = null;
export function registrarAoExpirar(fn: () => void) {
  aoExpirar = fn;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function montarUrl(caminho: string, query?: Query) {
  const url = new URL(BASE + caminho, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Chama a API e devolve o corpo no envelope ({ data } ou { data, meta }); erros viram ErroApi. */
async function chamar<T>(
  metodo: string,
  caminho: string,
  opcoes: { corpo?: unknown; query?: Query } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenArmazenado.ler();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opcoes.corpo instanceof FormData) body = opcoes.corpo;
  else if (opcoes.corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opcoes.corpo);
  }

  let res: Response;
  try {
    res = await fetch(montarUrl(caminho, opcoes.query), { method: metodo, headers, body });
  } catch {
    throw new ErroApi('Não foi possível falar com o servidor. Verifique sua conexão.', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) aoExpirar?.();
    const erro = json?.error;
    throw new ErroApi(erro?.mensagem ?? `Erro ${res.status}`, res.status, erro?.detalhes);
  }
  return json as T;
}

export const api = {
  get: <T>(caminho: string, query?: Query) =>
    chamar<{ data: T }>('GET', caminho, { query }).then((r) => r.data),
  pagina: <T>(caminho: string, query?: Query) =>
    chamar<{ data: T[]; meta: { pagina: number; porPagina: number; total: number } }>('GET', caminho, {
      query,
    }),
  post: <T>(caminho: string, corpo?: unknown) =>
    chamar<{ data: T }>('POST', caminho, { corpo }).then((r) => r.data),
  patch: <T>(caminho: string, corpo?: unknown) =>
    chamar<{ data: T }>('PATCH', caminho, { corpo }).then((r) => r.data),
  urlXml: (notaId: number) => montarUrl(`/notas/${notaId}/xml`),
  baixar: async (caminho: string, nomeArquivo: string) => {
    const res = await fetch(montarUrl(caminho), {
      headers: { Authorization: `Bearer ${tokenArmazenado.ler()}` },
    });
    if (!res.ok) throw new ErroApi('Não foi possível baixar o arquivo', res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  },
};
