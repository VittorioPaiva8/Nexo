import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Data no padrão ITAX: DD/MM/AAAA. */
export const formatarData = (iso: string | Date | null | undefined) =>
  iso ? dayjs(iso).format('DD/MM/YYYY') : '—';
export const formatarDataHora = (iso: string | Date | null | undefined) =>
  iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—';
export const formatarMoeda = (valor: string | number) => moeda.format(Number(valor));
export const formatarNumero = (valor: number) => numero.format(valor);

/** Horas em texto curto: "45 min", "5,5 h", "3 d 4 h". */
export function formatarDuracao(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return '—';
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 24) return `${numero.format(Math.round(horas * 10) / 10)} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas - dias * 24);
  return resto ? `${dias} d ${resto} h` : `${dias} d`;
}

export function formatarCnpj(doc: string | null | undefined): string {
  if (!doc) return '—';
  const d = doc.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

/** Chave de acesso em blocos de 4 dígitos, como no DANFE. */
export const formatarChave = (chave: string) => chave.replace(/(\d{4})(?=\d)/g, '$1 ');

/** Datas sem horário (prazo) vêm como meia-noite UTC: formatar só a parte da data. */
export function formatarDia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** "1,8 dia" / "3 dias". */
export function formatarDias(dias: number): string {
  const n = numero.format(dias);
  return `${n} ${dias > 0 && dias <= 1 ? 'dia' : 'dias'}`;
}

export const formatarPercentual = (p: number | null | undefined) =>
  p === null || p === undefined ? '—' : `${p}%`;

/** "AAAA-MM-DD" de hoje no fuso do navegador. */
export function hoje(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${numero.format(bytes / 1024 / 1024)} MB`;
}
