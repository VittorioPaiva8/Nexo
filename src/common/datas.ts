/** Datas de prazo são dias no fuso de Brasília (UTC-3, sem horário de verão). */
const FUSO = '-03:00';
const DIA_MS = 86_400_000;

/** "AAAA-MM-DD" do dia corrente em Brasília. */
export function hojeBrasilia(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Converte "AAAA-MM-DD" para a data gravada em colunas @db.Date (meia-noite UTC). */
export function dataDoDia(dia: string): Date {
  return new Date(`${dia.slice(0, 10)}T00:00:00Z`);
}

export function somarDias(dia: string, dias: number): string {
  return new Date(dataDoDia(dia).getTime() + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Último instante do dia do prazo em Brasília. */
export function fimDoPrazo(prazo: Date): Date {
  return new Date(`${prazo.toISOString().slice(0, 10)}T23:59:59.999${FUSO}`);
}

export function inicioDoDia(dia: string): Date {
  return new Date(`${dia.slice(0, 10)}T00:00:00${FUSO}`);
}

/** Lê "AAAA-MM-DD" ou "DD/MM/AAAA"; devolve "AAAA-MM-DD" ou null. */
export function lerDia(valor: string): string | null {
  const v = valor.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = dataDoDia(iso);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function horasEntre(inicio: Date, fim: Date | null, agora: Date): number {
  const ms = (fim ?? agora).getTime() - inicio.getTime();
  return Math.max(0, ms) / 3_600_000;
}
