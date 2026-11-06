import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { dataDoDia, hojeBrasilia, somarDias } from '../src/common/datas.js';
import { cnpjValido } from '../src/common/documentos.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Perfil, Prioridade, StatusDivergencia } from '../src/generated/prisma/enums.js';

/**
 * Dados iniciais: setores, catálogo de divergências (manual, seção 11) e usuários de cada perfil.
 * Senha de todos os usuários: SEED_SENHA (padrão "nexo123"). Troque antes de qualquer uso real.
 * Com SEED_DEMO=true e banco sem divergências, cria também ocorrências de demonstração.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
});

const SETORES = [
  { nome: 'Fiscal', descricao: 'Validação de notas', slaDias: 1 },
  { nome: 'Suprimentos', descricao: 'Pedidos e fornecedores', slaDias: 2 },
  { nome: 'Financeiro', descricao: 'Condições e cadastros', slaDias: 2 },
  { nome: 'Obras', descricao: 'Recebimento e medição', slaDias: 3 },
];

const TIPOS: Record<string, string[]> = {
  Suprimentos: [
    'Sem pedido de compra',
    'Divergência de quantidade',
    'Divergência de valores',
    'Desconto divergente',
    'Fornecedor divergente',
    'Produto divergente',
    'Entrega divergente',
  ],
  Fiscal: [
    'CNPJ emissor divergente',
    'CNPJ destinatário divergente',
    'CFOP / NCM incorreto',
    'Natureza da operação incorreta',
    'Duplicidade de nota',
    'Impostos destacados incorretamente',
    'XML inconsistente',
  ],
  Financeiro: [
    'Condição de pagamento',
    'Vencimento divergente',
    'Dados bancários',
    'Duplicidade de cobrança',
  ],
  Obras: ['Centro de custo incorreto', 'Apontamento de obra', 'Quantidade recebida', 'Item não reconhecido'],
};

const USUARIOS: { nome: string; email: string; perfil: Perfil; setor?: string }[] = [
  { nome: 'Administrador', email: 'admin@nexo.local', perfil: 'ADMIN', setor: 'Fiscal' },
  { nome: 'Equipe Fiscal', email: 'fiscal@nexo.local', perfil: 'FISCAL', setor: 'Fiscal' },
  { nome: 'Gestor Controladoria', email: 'gestor@nexo.local', perfil: 'GESTOR' },
  { nome: 'Tratador Suprimentos', email: 'suprimentos@nexo.local', perfil: 'TRATADOR', setor: 'Suprimentos' },
  { nome: 'Comprador Suprimentos', email: 'compras@nexo.local', perfil: 'TRATADOR', setor: 'Suprimentos' },
  { nome: 'Tratador Financeiro', email: 'financeiro@nexo.local', perfil: 'TRATADOR', setor: 'Financeiro' },
  { nome: 'Tratador Obras', email: 'obras@nexo.local', perfil: 'TRATADOR', setor: 'Obras' },
];

/** Gera um CNPJ válido a partir dos 12 primeiros dígitos. */
function cnpj(base: string): string {
  for (let dv = 0; dv < 100; dv++) {
    const c = base + String(dv).padStart(2, '0');
    if (cnpjValido(c)) return c;
  }
  throw new Error('CNPJ');
}

const FORNECEDORES = [
  { nome: 'Fornecedor Exemplo Alfa Ltda.', cnpj: cnpj('112223330001') },
  { nome: 'Fornecedor Exemplo Beta S.A.', cnpj: cnpj('445556660001') },
  { nome: 'Fornecedor Exemplo Gama Ltda.', cnpj: cnpj('778889990001') },
];

async function demonstracao() {
  if ((await prisma.divergencia.count()) > 0) return 0;
  const fiscal = await prisma.usuario.findUniqueOrThrow({ where: { email: 'fiscal@nexo.local' } });
  const tratadores = await prisma.usuario.findMany({
    where: { perfil: 'TRATADOR' },
    include: { setor: true },
  });
  const tipos = await prisma.tipoDivergencia.findMany({ include: { setorOrigem: true } });
  const hoje = hojeBrasilia();
  const ano = Number(hoje.slice(0, 4));
  const cenarios: { dias: number; status: StatusDivergencia; prazo: number; prioridade: Prioridade }[] = [
    { dias: 9, status: 'CONCLUIDA', prazo: -7, prioridade: 'NORMAL' },
    { dias: 7, status: 'CONCLUIDA', prazo: -4, prioridade: 'ALTA' },
    { dias: 6, status: 'CONCLUIDA', prazo: -5, prioridade: 'NORMAL' },
    { dias: 5, status: 'DEVOLVIDA', prazo: -2, prioridade: 'NORMAL' },
    { dias: 4, status: 'EM_TRATAMENTO', prazo: -1, prioridade: 'CRITICA' },
    { dias: 3, status: 'EM_TRATAMENTO', prazo: 0, prioridade: 'ALTA' },
    { dias: 2, status: 'DEVOLVIDA', prazo: 1, prioridade: 'NORMAL' },
    { dias: 1, status: 'PENDENTE', prazo: 1, prioridade: 'NORMAL' },
    { dias: 0, status: 'PENDENTE', prazo: 2, prioridade: 'ALTA' },
    { dias: 0, status: 'PENDENTE', prazo: 3, prioridade: 'NORMAL' },
  ];
  let seq = 0;
  for (const [i, c] of cenarios.entries()) {
    const tipo = tipos.filter((t) => t.setorOrigem?.nome !== 'Fiscal')[i % 12]!;
    const resp =
      tratadores.find((t) => t.setorId === tipo.setorOrigemId) ?? tratadores[i % tratadores.length]!;
    const forn = FORNECEDORES[i % FORNECEDORES.length]!;
    const abertaEm = new Date(Date.now() - c.dias * 86_400_000 - 2 * 3_600_000);
    const devolvidaEm = ['DEVOLVIDA', 'CONCLUIDA'].includes(c.status)
      ? new Date(abertaEm.getTime() + 20 * 3_600_000)
      : null;
    const concluidaEm =
      c.status === 'CONCLUIDA'
        ? new Date(devolvidaEm!.getTime() + (i === 1 ? 4 * 86_400_000 : 3_600_000))
        : null;
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: String(1250 + i),
        serie: '1',
        emitenteCnpj: forn.cnpj,
        emitenteNome: forn.nome,
        valorTotal: (1000 + i * 731.5).toFixed(2),
        dataEmissao: new Date(abertaEm.getTime() - 86_400_000),
        pedidoCompra: `PC-${2860 + i}`,
        origem: 'MANUAL',
        status: c.status === 'CONCLUIDA' ? 'AJUSTADA' : 'EM_AJUSTE',
      },
    });
    seq += 1;
    const prazo = dataDoDia(somarDias(hoje, c.prazo));
    await prisma.divergencia.create({
      data: {
        protocolo: `DF-${ano}-${String(seq).padStart(4, '0')}`,
        notaFiscalId: nota.id,
        tipoId: tipo.id,
        setorId: resp.setorId!,
        descricao: `Demonstração: ${tipo.nome.toLowerCase()} na NF ${nota.numero}. Conferir e regularizar.`,
        prioridade: c.prioridade,
        prazo,
        status: c.status,
        solicitanteId: fiscal.id,
        responsavelAtualId: resp.id,
        abertaEm,
        devolvidaEm,
        concluidaEm,
        devolutiva: devolvidaEm ? 'Pedido revisado conforme a nota fiscal e liberado para lançamento.' : null,
        tipoSolucao: devolvidaEm ? 'Pedido de compra corrigido' : null,
        parecer: concluidaEm ? 'Correção conferida no sistema de origem.' : null,
        atribuicoes: {
          create: {
            responsavelId: resp.id,
            setorId: resp.setorId,
            inicio: abertaEm,
            fim: devolvidaEm,
            motivoFim: devolvidaEm ? 'DEVOLVIDA' : null,
          },
        },
        movimentacoes: {
          create: [
            {
              autorId: fiscal.id,
              acao: 'CADASTRO',
              statusNovo: 'PENDENTE',
              texto: 'Ocorrência de demonstração cadastrada.',
              destinoId: resp.id,
              setorDestino: resp.setor?.nome,
              prazoNovo: prazo,
              criadaEm: abertaEm,
            },
            ...(c.status !== 'PENDENTE'
              ? [
                  {
                    autorId: resp.id,
                    acao: 'ASSUNCAO' as const,
                    statusAnterior: 'PENDENTE' as const,
                    statusNovo: 'EM_TRATAMENTO' as const,
                    texto: 'Solicitação assumida para regularização.',
                    criadaEm: new Date(abertaEm.getTime() + 3_600_000),
                  },
                ]
              : []),
            ...(devolvidaEm
              ? [
                  {
                    autorId: resp.id,
                    acao: 'DEVOLUCAO' as const,
                    statusAnterior: 'EM_TRATAMENTO' as const,
                    statusNovo: 'DEVOLVIDA' as const,
                    texto: 'Pedido revisado conforme a nota fiscal e liberado para lançamento.',
                    criadaEm: devolvidaEm,
                  },
                ]
              : []),
            ...(concluidaEm
              ? [
                  {
                    autorId: fiscal.id,
                    acao: 'CONCLUSAO' as const,
                    statusAnterior: 'DEVOLVIDA' as const,
                    statusNovo: 'CONCLUIDA' as const,
                    texto: 'Correção conferida no sistema de origem.',
                    criadaEm: concluidaEm,
                  },
                ]
              : []),
          ],
        },
      },
    });
  }
  await prisma.sequenciaProtocolo.upsert({
    where: { ano },
    create: { ano, ultimo: seq },
    update: { ultimo: seq },
  });
  return cenarios.length;
}

async function main() {
  for (const s of SETORES) {
    await prisma.setor.upsert({ where: { nome: s.nome }, update: {}, create: s });
  }
  let totalTipos = 0;
  for (const [setorNome, nomes] of Object.entries(TIPOS)) {
    const setor = await prisma.setor.findUniqueOrThrow({ where: { nome: setorNome } });
    for (const nome of nomes) {
      totalTipos += 1;
      await prisma.tipoDivergencia.upsert({
        where: { nome },
        update: {},
        create: { nome, setorOrigemId: setor.id },
      });
    }
  }
  await prisma.tipoDivergencia.upsert({ where: { nome: 'Outro' }, update: {}, create: { nome: 'Outro' } });

  const senhaHash = await bcrypt.hash(process.env['SEED_SENHA'] ?? 'nexo123', 10);
  for (const u of USUARIOS) {
    const setor = u.setor ? await prisma.setor.findUnique({ where: { nome: u.setor } }) : null;
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { nome: u.nome, email: u.email, perfil: u.perfil, senhaHash, setorId: setor?.id },
    });
  }
  const demo = process.env['SEED_DEMO'] === 'true' ? await demonstracao() : 0;
  console.log(
    `Seed concluído: ${SETORES.length} setores, ${totalTipos + 1} tipos, ${USUARIOS.length} usuários` +
      (demo ? `, ${demo} divergências de demonstração` : ''),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
