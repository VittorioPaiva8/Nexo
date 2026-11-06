import 'dotenv/config';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import type { Perfil } from '../src/generated/prisma/enums.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { gerarHashSenha } from '../src/common/senha.js';

process.env['DATABASE_URL'] = process.env['DATABASE_URL_TESTE'];
process.env['JWT_SECRET'] ??= 'segredo-de-teste';

export async function criarApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Limpa o banco de testes e cria setores, tipos e usuários de cada perfil. */
export async function prepararBanco(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE nexo."Notificacao", nexo."ConfigNotificacao", nexo."Anexo", nexo."Movimentacao",
      nexo."Atribuicao", nexo."Divergencia", nexo."SequenciaProtocolo", nexo."NotaFiscal",
      nexo."Importacao", nexo."Usuario", nexo."TipoDivergencia", nexo."Setor" RESTART IDENTITY CASCADE`,
  );
  const senhaHash = await gerarHashSenha('senha123', 1000);
  const fiscal = await prisma.setor.create({ data: { nome: 'Fiscal' } });
  const suprimentos = await prisma.setor.create({ data: { nome: 'Suprimentos', slaDias: 2 } });
  const financeiro = await prisma.setor.create({ data: { nome: 'Financeiro' } });
  const tipo = await prisma.tipoDivergencia.create({
    data: { nome: 'Divergência de quantidade', setorOrigemId: suprimentos.id },
  });
  const tipoSemPedido = await prisma.tipoDivergencia.create({
    data: { nome: 'Sem pedido de compra', setorOrigemId: suprimentos.id },
  });
  const criar = (nome: string, email: string, perfil: Perfil, setorId: number | null) =>
    prisma.usuario.create({ data: { nome, email, perfil, setorId, senhaHash } });
  return {
    setores: { fiscal, suprimentos, financeiro },
    tipo,
    tipoSemPedido,
    admin: await criar('Admin', 'admin@teste.com', 'ADMIN', fiscal.id),
    fiscal: await criar('Equipe Fiscal', 'fiscal@teste.com', 'FISCAL', fiscal.id),
    gestor: await criar('Gestora', 'gestor@teste.com', 'GESTOR', null),
    carla: await criar('Carla Suprimentos', 'carla@teste.com', 'TRATADOR', suprimentos.id),
    marcos: await criar('Marcos Suprimentos', 'marcos@teste.com', 'TRATADOR', suprimentos.id),
    ana: await criar('Ana Financeiro', 'ana@teste.com', 'TRATADOR', financeiro.id),
  };
}
