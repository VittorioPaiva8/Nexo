import 'dotenv/config';
import { execSync } from 'node:child_process';

/** Aplica as migrações no banco de testes antes da suíte e2e. */
export default function setup() {
  const url = process.env['DATABASE_URL_TESTE'];
  if (!url) throw new Error('Defina DATABASE_URL_TESTE no .env para rodar os testes e2e');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
