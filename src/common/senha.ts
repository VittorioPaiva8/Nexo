/**
 * Hash de senha com PBKDF2-SHA256 (Web Crypto), que roda igual no Node e no Cloudflare Workers.
 * Formato gravado: pbkdf2$<iterações>$<sal base64>$<hash base64>. As iterações ficam no próprio
 * hash, então dá para aumentar depois sem invalidar as senhas antigas.
 * O valor é moderado para caber no limite de CPU do plano gratuito do Workers.
 */
const ITERACOES = 30_000;
const BYTES = 32;

const paraBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as Uint8Array<ArrayBuffer>, iterations: iteracoes },
    chave,
    BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function gerarHashSenha(senha: string, iteracoes = ITERACOES): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(senha, sal, iteracoes);
  return ['pbkdf2', iteracoes, paraBase64(sal), paraBase64(hash)].join('$');
}

export async function conferirSenha(senha: string, gravado: string): Promise<boolean> {
  const [algoritmo, iteracoes, sal, esperado] = gravado.split('$');
  if (algoritmo !== 'pbkdf2' || !iteracoes || !sal || !esperado) return false;
  const hash = await derivar(senha, deBase64(sal), Number(iteracoes));
  const alvo = deBase64(esperado);
  if (hash.length !== alvo.length) return false;
  let diferenca = 0;
  for (let i = 0; i < hash.length; i++) diferenca |= hash[i]! ^ alvo[i]!;
  return diferenca === 0;
}
