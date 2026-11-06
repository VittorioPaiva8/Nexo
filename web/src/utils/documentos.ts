/** Mesmas validações do backend, para avisar antes de enviar. */
export const apenasDigitos = (v: string) => v.replace(/\D/g, '');

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

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv1 = dvCnpj(d.slice(0, 12));
  return d.endsWith(`${dv1}${dvCnpj(d.slice(0, 12) + dv1)}`);
}

export function chaveValida(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 44) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return Number(d[43]) === (resto < 2 ? 0 : 11 - resto);
}

/** Máscara progressiva 00.000.000/0000-00 enquanto digita. */
export function mascararCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
