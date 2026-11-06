import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Perfil } from '../src/generated/prisma/enums.js';

/**
 * Dados iniciais para desenvolvimento local.
 * Senha de todos os usuários: SEED_SENHA (padrão "nexo123"). Troque antes de qualquer uso real.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
});

const SETORES = ['Fiscal', 'Compras', 'Financeiro', 'Logística', 'Comercial'];
const TIPOS = [
  'Valor divergente do pedido',
  'Quantidade divergente',
  'CFOP incorreto',
  'NCM incorreto',
  'Dados do fornecedor incorretos',
  'Nota sem pedido vinculado',
  'Impostos destacados incorretamente',
  'Outros',
];
const USUARIOS: { nome: string; email: string; perfil: Perfil; setor?: string }[] = [
  { nome: 'Administrador', email: 'admin@nexo.local', perfil: 'ADMIN', setor: 'Fiscal' },
  { nome: 'Revisor Fiscal', email: 'revisor@nexo.local', perfil: 'REVISOR', setor: 'Fiscal' },
  { nome: 'Responsável Compras', email: 'compras@nexo.local', perfil: 'RESPONSAVEL', setor: 'Compras' },
  {
    nome: 'Responsável Financeiro',
    email: 'financeiro@nexo.local',
    perfil: 'RESPONSAVEL',
    setor: 'Financeiro',
  },
  { nome: 'Responsável Logística', email: 'logistica@nexo.local', perfil: 'RESPONSAVEL', setor: 'Logística' },
];

async function main() {
  for (const nome of SETORES) await prisma.setor.upsert({ where: { nome }, update: {}, create: { nome } });
  for (const nome of TIPOS)
    await prisma.tipoDivergencia.upsert({ where: { nome }, update: {}, create: { nome } });

  const senhaHash = await bcrypt.hash(process.env['SEED_SENHA'] ?? 'nexo123', 10);
  for (const u of USUARIOS) {
    const setor = u.setor ? await prisma.setor.findUnique({ where: { nome: u.setor } }) : null;
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { nome: u.nome, email: u.email, perfil: u.perfil, senhaHash, setorId: setor?.id },
    });
  }
  console.log(
    `Seed concluído: ${SETORES.length} setores, ${TIPOS.length} tipos, ${USUARIOS.length} usuários`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
