/** Validações e normalizações de documentos fiscais usadas no cadastro manual e na importação. */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function dvCnpj(base: string): number {
  let peso = base.length - 7;
  let soma = 0;
  for (const c of base) {
    soma += Number(c) * peso--;
    if (peso < 2) peso = 9;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida o CNPJ pelos dígitos verificadores (aceita com ou sem máscara). */
export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv1 = dvCnpj(d.slice(0, 12));
  const dv2 = dvCnpj(d.slice(0, 12) + dv1);
  return d.endsWith(`${dv1}${dv2}`);
}

/** Valida a chave de acesso da NF-e: 44 dígitos com dígito verificador módulo 11. */
export function chaveAcessoValida(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 44) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return Number(d[43]) === dv;
}

export function formatarCnpj(valor: string): string {
  const d = apenasDigitos(valor);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : valor;
}

/**
 * Converte valores em formato brasileiro ("10.500,00", "10500,00") ou com ponto decimal ("10500.00")
 * para string decimal com duas casas. Devolve null se não for um número positivo.
 */
export function lerValor(valor: string): string | null {
  let v = valor.trim().replace(/^R\$\s*/i, '');
  if (!v) return null;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n.toFixed(2) : null;
}

/** Normaliza nomes para comparação: sem acento, minúsculo e espaços simples. */
export function normalizarNome(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Número e série da NF sem zeros à esquerda ("000125" e "125" são a mesma nota). */
export function normalizarNumero(valor: string): string {
  return apenasDigitos(valor).replace(/^0+(?=\d)/, '');
}
