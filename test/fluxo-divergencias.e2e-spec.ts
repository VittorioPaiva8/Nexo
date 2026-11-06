import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeBrasilia, somarDias } from '../src/common/datas.js';
import { chaveAcessoValida } from '../src/common/documentos.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { criarApp, prepararBanco } from './app.js';
import { xmlNfeExemplo } from './fixtures/nfe-exemplo.js';

const CHAVE_1 = '35261112345678000190550010000012341000012345';
const CHAVE_2 = '35261112345678000190550010000012351000012346';
const CNPJ = '11.222.333/0001-81';
const ANO = hojeBrasilia().slice(0, 4);
const AMANHA = somarDias(hojeBrasilia(), 1);

function chaveValida(base43: string) {
  for (let dv = 0; dv < 10; dv++) if (chaveAcessoValida(base43 + dv)) return base43 + dv;
  throw new Error('chave');
}

describe('Fluxo Fiscal de divergências (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dados: Awaited<ReturnType<typeof prepararBanco>>;
  const t: Record<string, string> = {};
  // Com E2E_URL (ex.: http://127.0.0.1:8787/api) os mesmos testes rodam contra a API do Worker.
  const http = () => request(process.env['E2E_URL'] ?? app.getHttpServer());
  const como = (quem: string) => ({ Authorization: `Bearer ${t[quem]}` });

  async function login(email: string) {
    const res = await http().post('/auth/login').send({ email, senha: 'senha123' }).expect(200);
    return res.body.data.token as string;
  }

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
    dados = await prepararBanco(prisma);
    for (const quem of ['fiscal', 'gestor', 'carla', 'marcos', 'ana'])
      t[quem] = await login(`${quem}@teste.com`);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('bloqueia acesso sem token e valida DTOs com o envelope de erro', async () => {
    const res = await http().get('/divergencias').expect(401);
    expect(res.body).toEqual({ error: { status: 401, mensagem: 'Faça login para continuar' } });
    const inv = await http().post('/auth/login').send({ email: 'x' }).expect(400);
    expect(inv.body.error.detalhes).toContain('Informe um e-mail válido');
  });

  let notaXmlId: number;
  it('importa XMLs de NF-e, ignora duplicadas e aponta inválidos', async () => {
    const res = await http()
      .post('/notas/importar')
      .set(como('fiscal'))
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_1 })), 'nota1.xml')
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_2, numero: '1235' })), 'nota2.xml')
      .attach('arquivos', Buffer.from(xmlNfeExemplo({ chave: CHAVE_1 })), 'nota1-copia.xml')
      .attach('arquivos', Buffer.from('<lixo/>'), 'invalido.xml')
      .expect(201);
    expect(res.body.data.importacao).toMatchObject({
      totalImportadas: 2,
      totalDuplicadas: 1,
      totalInvalidas: 1,
    });
    notaXmlId = res.body.data.notas.find((n: { chaveAcesso: string }) => n.chaveAcesso === CHAVE_1).id;

    await http()
      .post('/notas/importar')
      .set(como('carla'))
      .attach('arquivos', Buffer.from(xmlNfeExemplo()), 'n.xml')
      .expect(403);
  });

  let divId: number;
  let notaManualId: number;
  it('cadastra divergência com nota manual, gera protocolo e encaminha ao setor', async () => {
    const corpo = {
      nota: {
        numero: '000125',
        serie: '1',
        chaveAcesso: chaveValida('4126111122233300018155001000000125100000125'),
        emitenteNome: 'Materiais Alfa Ltda.',
        emitenteCnpj: CNPJ,
        valorTotal: '10500.00',
        dataEmissao: '2026-11-05',
        pedidoCompra: 'PC-02861',
        centroCusto: '26.30',
        unidade: 'Cascavel',
      },
      tipoId: dados.tipo.id,
      setorId: dados.setores.suprimentos.id,
      responsavelId: dados.carla.id,
      prioridade: 'ALTA',
      prazo: AMANHA,
      descricao: 'Quantidade da NF (12) diferente do pedido (10). Ajustar o pedido.',
      valorNf: '12 un',
      valorEsperado: '10 un',
    };

    const cnpjRuim = await http()
      .post('/divergencias')
      .set(como('fiscal'))
      .send({ ...corpo, nota: { ...corpo.nota, emitenteCnpj: '11.222.333/0001-80' } })
      .expect(400);
    expect(cnpjRuim.body.error.detalhes).toContain('nota.CNPJ do emissor inválido (confira os dígitos)');

    const foraDoSetor = await http()
      .post('/divergencias')
      .set(como('fiscal'))
      .send({ ...corpo, responsavelId: dados.ana.id })
      .expect(400);
    expect(foraDoSetor.body.error.mensagem).toMatch(/não pertence ao setor Suprimentos/);

    await http().post('/divergencias').set(como('carla')).send(corpo).expect(403);

    const res = await http().post('/divergencias').set(como('fiscal')).send(corpo).expect(201);
    const d = res.body.data[0];
    expect(d).toMatchObject({
      protocolo: `DF-${ANO}-0001`,
      status: 'PENDENTE',
      prioridade: 'ALTA',
      atrasada: false,
      setor: { nome: 'Suprimentos' },
      responsavelAtual: { nome: 'Carla Suprimentos' },
      notaFiscal: { numero: '125', emitenteCnpj: '11222333000181', pedidoCompra: 'PC-02861' },
    });
    expect(d.prazo.slice(0, 10)).toBe(AMANHA);
    divId = d.id;
    notaManualId = d.notaFiscalId;

    const dup = await http().post('/divergencias').set(como('fiscal')).send(corpo).expect(409);
    expect(dup.body.error.mensagem).toContain(`DF-${ANO}-0001`);
  });

  let div2Id: number;
  it('marca nota importada por XML e usa o SLA do setor quando não há prazo', async () => {
    const res = await http()
      .post('/divergencias')
      .set(como('fiscal'))
      .send({
        notaFiscalIds: [notaXmlId],
        tipoId: dados.tipoSemPedido.id,
        setorId: dados.setores.suprimentos.id,
        responsavelId: dados.marcos.id,
        descricao: 'Nota sem pedido de compra associado.',
      })
      .expect(201);
    div2Id = res.body.data[0].id;
    expect(res.body.data[0].protocolo).toBe(`DF-${ANO}-0002`);
    expect(res.body.data[0].prazo.slice(0, 10)).toBe(somarDias(hojeBrasilia(), 2));
  });

  it('tratador vê só o próprio setor e a própria fila', async () => {
    const minhas = await http().get('/divergencias?escopo=minhas').set(como('carla'));
    expect(minhas.body.data.map((d: { id: number }) => d.id)).toEqual([divId]);
    const setor = await http().get('/divergencias').set(como('carla'));
    expect(setor.body.meta.total).toBe(2);
    const ana = await http().get('/divergencias').set(como('ana'));
    expect(ana.body.data).toEqual([]);
    await http().get(`/divergencias/${divId}`).set(como('ana')).expect(403);
    await http().get('/divergencias?escopo=validacao').set(como('carla')).expect(403);
    const busca = await http().get('/divergencias?busca=000125').set(como('fiscal'));
    expect(busca.body.data.map((d: { id: number }) => d.id)).toEqual([divId]);
  });

  let anexoId: number;
  it('responsável assume, salva rascunho e devolve ao Fiscal com evidência', async () => {
    await http().post(`/divergencias/${divId}/assumir`).set(como('marcos')).expect(403);
    const assumida = await http().post(`/divergencias/${divId}/assumir`).set(como('carla')).expect(200);
    expect(assumida.body.data.status).toBe('EM_TRATAMENTO');

    const rasc = await http()
      .put(`/divergencias/${divId}/rascunho`)
      .set(como('carla'))
      .send({ texto: 'Conferindo com o comprador', tipoSolucao: 'Pedido de compra corrigido' })
      .expect(200);
    expect(rasc.body.data.rascunho).toBe('Conferindo com o comprador');

    const curta = await http()
      .post(`/divergencias/${divId}/devolver`)
      .set(como('carla'))
      .field('texto', 'feito')
      .expect(400);
    expect(curta.body.error.detalhes[0]).toMatch(/Descreva a ação realizada/);

    const res = await http()
      .post(`/divergencias/${divId}/devolver`)
      .set(como('carla'))
      .field('texto', 'Pedido ajustado de 10 para 12 unidades conforme NF.')
      .field('tipoSolucao', 'Pedido de compra corrigido')
      .attach('arquivos', Buffer.from('%PDF-1.4 evidencia'), 'pedido-corrigido.pdf')
      .expect(200);
    const d = res.body.data;
    expect(d).toMatchObject({
      status: 'DEVOLVIDA',
      rascunho: null,
      tipoSolucao: 'Pedido de compra corrigido',
    });
    expect(d.anexos).toHaveLength(1);
    expect(d.anexos[0]).toMatchObject({ categoria: 'EVIDENCIA', nomeArquivo: 'pedido-corrigido.pdf' });
    expect(d.anexos[0].sha256).toHaveLength(64);
    anexoId = d.anexos[0].id;

    await http()
      .post(`/divergencias/${divId}/devolver`)
      .set(como('carla'))
      .field('texto', 'De novo, de novo')
      .expect(409);

    const avisos = await http().get('/notificacoes').set(como('fiscal')).expect(200);
    expect(avisos.body.data.naoLidas).toBe(1);
    expect(avisos.body.data.itens[0]).toMatchObject({ evento: 'DEVOLUCAO', situacao: 'NAO_ENVIADA' });
  });

  it('anexo só para quem participa', async () => {
    const res = await http().get(`/divergencias/anexos/${anexoId}`).set(como('fiscal')).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    await http().get(`/divergencias/anexos/${anexoId}`).set(como('ana')).expect(403);
  });

  it('Fiscal reabre com motivo e novo prazo, setor devolve e o Fiscal conclui', async () => {
    await http()
      .post(`/divergencias/${divId}/concluir`)
      .set(como('carla'))
      .send({ parecer: 'ok' })
      .expect(403);
    await http().post(`/divergencias/${divId}/reabrir`).set(como('fiscal')).send({}).expect(400);

    const novoPrazo = somarDias(hojeBrasilia(), 3);
    const reaberta = await http()
      .post(`/divergencias/${divId}/reabrir`)
      .set(como('fiscal'))
      .send({ motivo: 'O valor unitário ainda não confere.', prazo: novoPrazo })
      .expect(200);
    expect(reaberta.body.data).toMatchObject({ status: 'EM_TRATAMENTO', reaberturas: 1 });
    expect(reaberta.body.data.prazo.slice(0, 10)).toBe(novoPrazo);
    expect(reaberta.body.data.prazoOriginal.slice(0, 10)).toBe(AMANHA);

    await http()
      .post(`/divergencias/${divId}/devolver`)
      .set(como('carla'))
      .send({ texto: 'Valor unitário corrigido no pedido e liberado.' })
      .expect(200);

    const res = await http()
      .post(`/divergencias/${divId}/concluir`)
      .set(como('fiscal'))
      .send({ parecer: 'Pedido conferido no ERP; lançamento liberado.' })
      .expect(200);
    const d = res.body.data;
    expect(d.status).toBe('CONCLUIDA');
    expect(d.parecer).toBe('Pedido conferido no ERP; lançamento liberado.');
    expect(
      d.movimentacoes.map((m: { acao: string; statusAnterior: string | null; statusNovo: string }) => [
        m.acao,
        m.statusAnterior,
        m.statusNovo,
      ]),
    ).toEqual([
      ['CADASTRO', null, 'PENDENTE'],
      ['ASSUNCAO', 'PENDENTE', 'EM_TRATAMENTO'],
      ['DEVOLUCAO', 'EM_TRATAMENTO', 'DEVOLVIDA'],
      ['REABERTURA', 'DEVOLVIDA', 'EM_TRATAMENTO'],
      ['DEVOLUCAO', 'EM_TRATAMENTO', 'DEVOLVIDA'],
      ['CONCLUSAO', 'DEVOLVIDA', 'CONCLUIDA'],
    ]);
    expect(d.movimentacoes[3].prazoAnterior.slice(0, 10)).toBe(AMANHA);
    expect(d.atribuicoes.map((a: { motivoFim: string }) => a.motivoFim)).toEqual(['DEVOLVIDA', 'DEVOLVIDA']);

    const nota = await http().get(`/notas/${notaManualId}`).set(como('fiscal'));
    expect(nota.body.data.status).toBe('AJUSTADA');
  });

  it('redistribuição respeita o setor; gestor pode designar fora dele', async () => {
    await http()
      .post(`/divergencias/${div2Id}/redistribuir`)
      .set(como('carla'))
      .send({ responsavelId: dados.ana.id, motivo: 'Não é comigo' })
      .expect(403);
    const fora = await http()
      .post(`/divergencias/${div2Id}/redistribuir`)
      .set(como('fiscal'))
      .send({ responsavelId: dados.ana.id, motivo: 'Pagamento negociado pelo Financeiro.' })
      .expect(400);
    expect(fora.body.error.mensagem).toMatch(/somente o gestor/);

    const res = await http()
      .post(`/divergencias/${div2Id}/redistribuir`)
      .set(como('fiscal'))
      .send({
        setorId: dados.setores.financeiro.id,
        responsavelId: dados.ana.id,
        motivo: 'Pagamento negociado pelo Financeiro.',
      })
      .expect(200);
    expect(res.body.data).toMatchObject({ status: 'PENDENTE', setor: { nome: 'Financeiro' } });

    const gestor = await http()
      .post(`/divergencias/${div2Id}/redistribuir`)
      .set(como('gestor'))
      .send({ responsavelId: dados.marcos.id, motivo: 'Volta para o comprador do pedido.' })
      .expect(200);
    expect(gestor.body.data).toMatchObject({
      setor: { nome: 'Financeiro' },
      responsavelAtual: { nome: 'Marcos Suprimentos' },
    });
  });

  const CSV = [
    'numero_nf;serie;cnpj_emissor;fornecedor;valor_total;tipo_divergencia;setor;responsavel;descricao',
    '000456;1;98.765.432/0001-98;Pavimentar Insumos S.A.;4.320,00;Divergência de quantidade;Suprimentos;Carla Suprimentos;Quantidade divergente do pedido',
    '000457;1;11.111.111/1111-11;Fornecedor X;100,00;Divergência de quantidade;Suprimentos;Carla Suprimentos;CNPJ com dígito errado',
    '000458;1;98.765.432/0001-98;Pavimentar Insumos S.A.;100,00;Tipo inexistente;Suprimentos;;Tipo que não existe',
    '000456;1;98.765.432/0001-98;Pavimentar Insumos S.A.;4.320,00;Divergência de quantidade;;;Mesma linha repetida no arquivo',
    `1234;1;12.345.678/0001-95;Fornecedor XML;1500,00;Sem pedido de compra;;;Já aberta pelo cadastro anterior`,
    '000460;2;98.765.432/0001-98;Pavimentar Insumos S.A.;800,00;Sem pedido de compra;;;Usa setor e responsável padrão do lote',
  ].join('\n');

  it('importação CSV confere o lote antes de gravar', async () => {
    const res = await http()
      .post('/importacoes/csv/previa')
      .set(como('fiscal'))
      .field('setorId', String(dados.setores.suprimentos.id))
      .field('responsavelId', String(dados.marcos.id))
      .attach('arquivo', Buffer.from(`﻿${CSV}`), 'lote.csv')
      .expect(200);
    const r = res.body.data;
    expect(r).toMatchObject({ totalLinhas: 6, validas: 2, duplicadas: 2, invalidas: 2 });
    expect(r.linhas.map((l: { situacao: string }) => l.situacao)).toEqual([
      'VALIDA',
      'INVALIDA',
      'INVALIDA',
      'DUPLICADA',
      'DUPLICADA',
      'VALIDA',
    ]);
    expect(r.linhas[1].erros).toContain('CNPJ do emissor inválido');
    expect(r.linhas[2].erros).toContain('Tipo de divergência "Tipo inexistente" não cadastrado');
    expect(r.linhas[3].erros[0]).toBe('Repete a linha 2 do arquivo');
    expect(r.linhas[4].erros[0]).toBe(`Já existe a divergência DF-${ANO}-0002 aberta para esta NF e tipo`);
    expect(r.linhas[5]).toMatchObject({ setor: 'Suprimentos', responsavel: 'Marcos Suprimentos' });
    expect(await prisma.divergencia.count()).toBe(2);

    const semColuna = await http()
      .post('/importacoes/csv/previa')
      .set(como('fiscal'))
      .attach('arquivo', Buffer.from('numero_nf;serie\n1;1'), 'lote.csv')
      .expect(400);
    expect(semColuna.body.error.mensagem).toMatch(/Coluna\(s\) ausente\(s\)/);
  });

  it('confirma o lote, cria só as válidas e não duplica ao reimportar', async () => {
    const enviar = () =>
      http()
        .post('/importacoes/csv')
        .set(como('fiscal'))
        .field('setorId', String(dados.setores.suprimentos.id))
        .field('responsavelId', String(dados.marcos.id))
        .attach('arquivo', Buffer.from(CSV), 'lote.csv');
    const res = await enviar().expect(201);
    expect(res.body.data.importacao).toMatchObject({ origem: 'CSV', totalImportadas: 2 });
    expect(
      res.body.data.linhas
        .filter((l: { protocolo?: string }) => l.protocolo)
        .map((l: { protocolo: string }) => l.protocolo),
    ).toEqual([`DF-${ANO}-0003`, `DF-${ANO}-0004`]);

    const again = await enviar().expect(400);
    expect(again.body.error.mensagem).toBe('Nenhuma linha válida para importar');
    await http()
      .post('/importacoes/csv')
      .set(como('carla'))
      .attach('arquivo', Buffer.from(CSV), 'l.csv')
      .expect(403);
  });

  it('painel e relatórios calculam sobre os registros gravados', async () => {
    // Simula que a Carla segurou a primeira tratativa por 5 horas.
    const primeira = await prisma.atribuicao.findFirstOrThrow({
      where: { divergenciaId: divId },
      orderBy: { id: 'asc' },
    });
    await prisma.atribuicao.update({
      where: { id: primeira.id },
      data: { inicio: new Date(Date.now() - 5 * 3_600_000), fim: new Date() },
    });

    const rel = await http().get('/metricas').set(como('gestor')).expect(200);
    const m = rel.body.data;
    expect(m.resumo).toMatchObject({
      total: 4,
      concluidas: 1,
      abertas: 3,
      taxaSla: 100,
      taxaReabertura: 100,
    });
    expect(m.porSetor.find((s: { nome: string }) => s.nome === 'Suprimentos')).toMatchObject({ total: 3 });
    expect(m.tempoPorSetor[0]).toMatchObject({ nome: 'Suprimentos' });
    expect(m.tempoPorSetor[0].horasTotais).toBeGreaterThanOrEqual(5);
    expect(m.porFornecedor[0]).toMatchObject({ nome: 'Pavimentar Insumos S.A.', quantidade: 2 });

    const painel = await http().get('/metricas/painel').set(como('fiscal')).expect(200);
    expect(painel.body.data.kpis).toMatchObject({
      abertas: 3,
      cadastradasHoje: 4,
      concluidasMes: 1,
      noPrazoMes: 100,
    });
    expect(painel.body.data.atencao).toHaveLength(3);
    expect(painel.body.data.volumePorDia).toHaveLength(12);

    const cont = await http().get('/divergencias/contadores').set(como('marcos')).expect(200);
    expect(cont.body.data).toMatchObject({ minhas: 2, pendentes: 3 });

    await http().get('/metricas').set(como('carla')).expect(403);
  });
});
