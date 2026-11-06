import 'dotenv/config';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env['DATABASE_URL'] = process.env['DATABASE_URL_TESTE'];
process.env['JWT_SECRET'] ??= 'segredo-de-teste';

export async function criarApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Limpa o banco de testes e cria setores, tipo e usuários básicos. */
export async function prepararBanco(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE nexo."Mensagem", nexo."Atribuicao", nexo."Divergencia", nexo."NotaFiscal", nexo."Importacao", nexo."Usuario", nexo."TipoDivergencia", nexo."Setor" RESTART IDENTITY CASCADE',
  );
  const senhaHash = await bcrypt.hash('senha123', 4);
  const fiscal = await prisma.setor.create({ data: { nome: 'Fiscal' } });
  const compras = await prisma.setor.create({ data: { nome: 'Compras' } });
  const financeiro = await prisma.setor.create({ data: { nome: 'Financeiro' } });
  const tipo = await prisma.tipoDivergencia.create({ data: { nome: 'Valor divergente do pedido' } });
  const criar = (nome: string, email: string, perfil: 'ADMIN' | 'REVISOR' | 'RESPONSAVEL', setorId: number) =>
    prisma.usuario.create({ data: { nome, email, perfil, setorId, senhaHash } });
  return {
    setores: { fiscal, compras, financeiro },
    tipo,
    admin: await criar('Admin', 'admin@teste.com', 'ADMIN', fiscal.id),
    revisor: await criar('Revisor', 'revisor@teste.com', 'REVISOR', fiscal.id),
    compras: await criar('Ana Compras', 'ana@teste.com', 'RESPONSAVEL', compras.id),
    financeiro: await criar('Beto Financeiro', 'beto@teste.com', 'RESPONSAVEL', financeiro.id),
  };
}
