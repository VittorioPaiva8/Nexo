import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { criarApp, prepararBanco } from './app.js';
import { xmlNfeExemplo } from './fixtures/nfe-exemplo.js';

const CHAVE_1 = '35261112345678000190550010000012341000012345';
const CHAVE_2 = '35261112345678000190550010000012351000012346';

describe('Fluxo de NF-es divergentes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dados: Awaited<ReturnType<typeof prepararBanco>>;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  async function login(email: string) {
    const res = await http().post('/auth/login').send({ email, senha: 'senha123' }).expect(200);
    return res.body.data.token as string;
  }

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
    dados = await prepararBanco(prisma);
    tokens['revisor'] = await login('revisor@teste.com');
    tokens['ana'] = await login('ana@teste.com');
    tokens['beto'] = await login('beto@teste.com');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('bloqueia acesso sem token com o envelope de erro', async () => {
    const res = await http().get('/notas').expect(401);
    expect(res.body).toEqual({ error: { status: 401, mensagem: 'Faça login para continuar' } });
  });

  it('valida a entrada com DTO', async () => {
    const res = await http().post('/auth/login').send({ email: 'x' }).expect(400);
    expect(res.body.error.mensagem).toBe('Dados inválidos');
    expect(res.body.error.detalhes).toContain('Informe um e-mail válido');
  });

  let notaId: number;
  it('importa XMLs, ignora duplicadas e aponta arquivos inválidos', async () => {
    const res = await http()
      .post('/notas/importar')
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_1 })), 'nota1.xml')
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_2, numero: '1235' })), 'nota2.xml')
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_1 })), 'nota1-copia.xml')
      .attach('arquivos', Buffer.from('<lixo/>'), 'invalido.xml')
      .expect(201);

    const { importacao, notas, duplicadas, erros } = res.body.data;
    expect(importacao).toMatchObject({
      totalArquivos: 4,
      totalImportadas: 2,
      totalDuplicadas: 1,
      totalInvalidas: 1,
    });
    expect(notas).toHaveLength(2);
    expect(duplicadas).toEqual([{ arquivo: 'nota1-copia.xml', chaveAcesso: CHAVE_1 }]);
    expect(erros[0].arquivo).toBe('invalido.xml');
    notaId = notas.find((n: { chaveAcesso: string }) => n.chaveAcesso === CHAVE_1).id;

    const again = await http()
      .post('/notas/importar')
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_1 })), 'nota1.xml')
      .expect(201);
    expect(again.body.data.importacao.totalDuplicadas).toBe(1);
  });

  it('responsável não pode importar (perfil verificado no backend)', async () => {
    await http()
      .post('/notas/importar')
      .set('Authorization', `Bearer ${tokens['ana']}`)
      .attach('arquivos', Buffer.from(xmlNfeExemplo()), 'n.xml')
      .expect(403);
  });

  it('lista as notas paginadas com { data, meta }', async () => {
    const res = await http()
      .get('/notas?porPagina=1')
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ pagina: 1, porPagina: 1, total: 2 });
  });

  let divergenciaId: number;
  it('marca a nota como divergente e encaminha para Compras', async () => {
    const res = await http()
      .post('/divergencias')
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .send({
        notaFiscalIds: [notaId],
        tipoId: dados.tipo.id,
        descricao: 'Valor da nota diferente do pedido 4512.',
        responsavelId: dados.compras.id,
      })
      .expect(201);
    divergenciaId = res.body.data[0].id;
    expect(res.body.data[0]).toMatchObject({ status: 'PENDENTE', responsavelAtual: { nome: 'Ana Compras' } });

    const nota = await http().get(`/notas/${notaId}`).set('Authorization', `Bearer ${tokens['revisor']}`);
    expect(nota.body.data.status).toBe('EM_AJUSTE');
  });

  it('a nota aparece como pendente só para a responsável', async () => {
    const ana = await http()
      .get('/divergencias?escopo=minhas')
      .set('Authorization', `Bearer ${tokens['ana']}`);
    expect(ana.body.data.map((d: { id: number }) => d.id)).toEqual([divergenciaId]);
    const beto = await http()
      .get('/divergencias?escopo=minhas')
      .set('Authorization', `Bearer ${tokens['beto']}`);
    expect(beto.body.data).toEqual([]);
    await http()
      .get('/divergencias?escopo=todas')
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .expect(403);
    await http()
      .get(`/divergencias/${divergenciaId}`)
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .expect(403);
  });

  it('Compras repassa para o Financeiro, que responde', async () => {
    await http()
      .post(`/divergencias/${divergenciaId}/responder`)
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .send({ tipo: 'JUSTIFICATIVA', texto: 'Não é comigo' })
      .expect(403);

    await http()
      .post(`/divergencias/${divergenciaId}/repassar`)
      .set('Authorization', `Bearer ${tokens['ana']}`)
      .send({ responsavelId: dados.financeiro.id, texto: 'O pagamento foi negociado pelo Financeiro.' })
      .expect(200);

    const res = await http()
      .post(`/divergencias/${divergenciaId}/responder`)
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .send({ tipo: 'CORRECAO', texto: 'Fornecedor emitiu carta de correção.' })
      .expect(200);
    expect(res.body.data.status).toBe('AGUARDANDO_REVISAO');

    await http()
      .post(`/divergencias/${divergenciaId}/responder`)
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .send({ tipo: 'CORRECAO', texto: 'De novo' })
      .expect(409);
  });

  it('revisor devolve, Financeiro responde de novo e o revisor aceita', async () => {
    await http()
      .post(`/divergencias/${divergenciaId}/devolver`)
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .send({ texto: 'Carta de correção não altera valor; precisa reemitir.' })
      .expect(200);

    await http()
      .post(`/divergencias/${divergenciaId}/responder`)
      .set('Authorization', `Bearer ${tokens['beto']}`)
      .send({ tipo: 'CORRECAO', texto: 'Nota reemitida: NF 1240.' })
      .expect(200);

    const res = await http()
      .post(`/divergencias/${divergenciaId}/aceitar`)
      .set('Authorization', `Bearer ${tokens['revisor']}`)
      .send({})
      .expect(200);

    const d = res.body.data;
    expect(d.status).toBe('RESOLVIDA');
    expect(d.mensagens.map((m: { tipo: string }) => m.tipo)).toEqual([
      'SOLICITACAO',
      'REPASSE',
      'CORRECAO',
      'DEVOLUCAO',
      'CORRECAO',
      'ACEITE',
    ]);
    expect(
      d.atribuicoes.map((a: { responsavel: { nome: string }; motivoFim: string; fim: string | null }) => [
        a.responsavel.nome,
        a.motivoFim,
        a.fim !== null,
      ]),
    ).toEqual([
      ['Ana Compras', 'REPASSADA', true],
      ['Beto Financeiro', 'RESPONDIDA', true],
      ['Beto Financeiro', 'RESPONDIDA', true],
    ]);

    const nota = await http().get(`/notas/${notaId}`).set('Authorization', `Bearer ${tokens['revisor']}`);
    expect(nota.body.data.status).toBe('AJUSTADA');
  });

  it('o painel mostra o tempo por setor e a taxa de reabertura', async () => {
    // Simula que a Ana segurou a nota por 5 horas.
    await prisma.atribuicao.updateMany({
      where: { divergenciaId, responsavelId: dados.compras.id },
      data: { inicio: new Date(Date.now() - 5 * 3_600_000), fim: new Date() },
    });
    const res = await http().get('/metricas').set('Authorization', `Bearer ${tokens['revisor']}`).expect(200);
    const m = res.body.data;
    expect(m.resumo).toMatchObject({ total: 1, resolvidas: 1, abertas: 0, taxaReabertura: 100 });
    expect(m.porSetor[0]).toMatchObject({ nome: 'Compras', passagens: 1 });
    expect(m.porSetor[0].horasTotais).toBeCloseTo(5, 0);
    expect(m.porSetor.find((s: { nome: string }) => s.nome === 'Financeiro').passagens).toBe(2);

    await http().get('/metricas').set('Authorization', `Bearer ${tokens['ana']}`).expect(403);
  });
});
