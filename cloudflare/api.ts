/**
 * API do Nexo no Cloudflare Workers (plano gratuito).
 *
 * Usa as mesmas regras de negócio da API NestJS (services, DTOs e validações de src/), trocando só
 * a camada HTTP: rotas em Hono, autenticação JWT por Web Crypto e um PrismaClient por requisição.
 * Os caminhos e respostas são os mesmos da API NestJS ({ data }, { data, meta } e { error }).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { Hono, type Context } from 'hono';
import { sign, verify } from 'hono/jwt';
import 'reflect-metadata';
import { MAX_ANEXO_BYTES, MAX_ANEXOS, type ArquivoRecebido } from '../src/anexos/arquivos.js';
import { LoginDto } from '../src/auth/dto/login.dto.js';
import { Paginado } from '../src/common/paginado.js';
import { conferirSenha } from '../src/common/senha.js';
import type { UsuarioAutenticado } from '../src/common/usuario-atual.js';
import { DivergenciasService } from '../src/divergencias/divergencias.service.js';
import {
  ConcluirDto,
  CriarDivergenciaDto,
  DevolverDto,
  FiltroDivergenciasDto,
  RascunhoDto,
  ReabrirDto,
  RedistribuirDto,
} from '../src/divergencias/dto/divergencias.dto.js';
import { PadroesLoteDto } from '../src/importacoes/dto/importacoes.dto.js';
import { ImportacoesService } from '../src/importacoes/importacoes.service.js';
import { FiltroMetricasDto } from '../src/metricas/dto/metricas.dto.js';
import { MetricasService } from '../src/metricas/metricas.service.js';
import { FiltroNotasDto } from '../src/notas/dto/notas.dto.js';
import { NotasService } from '../src/notas/notas.service.js';
import { ConfigurarAvisoDto } from '../src/notificacoes/dto/notificacoes.dto.js';
import { NotificacoesService } from '../src/notificacoes/notificacoes.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { AtualizarSetorDto, CriarSetorDto } from '../src/setores/dto/setor.dto.js';
import {
  AtualizarTipoDivergenciaDto,
  CriarTipoDivergenciaDto,
} from '../src/tipos-divergencia/dto/tipo-divergencia.dto.js';
import { AtualizarUsuarioDto, CriarUsuarioDto, FiltroUsuariosDto } from '../src/usuarios/dto/usuario.dto.js';
import { usuarioPublico } from '../src/usuarios/usuario-publico.js';
import { UsuariosService } from '../src/usuarios/usuarios.service.js';
import { Prisma, PrismaClient } from '../src/generated/prisma-worker/client.js';
import { CategoriaAnexo, EventoNotificacao, type Perfil } from '../src/generated/prisma-worker/enums.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from './stubs/nest-common.js';

export interface EnvApi {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
}

interface Servicos {
  prisma: PrismaService;
  usuarios: UsuariosService;
  notificacoes: NotificacoesService;
  divergencias: DivergenciasService;
  importacoes: ImportacoesService;
  metricas: MetricasService;
  notas: NotasService;
}

type Ambiente = { Bindings: EnvApi; Variables: { s: Servicos; usuario: UsuarioAutenticado } };
type Ctx = Context<Ambiente>;

const FISCAIS: Perfil[] = ['FISCAL', 'GESTOR', 'ADMIN'];

// ---------- Infraestrutura: banco, envelope, validação ----------

function criarServicos(env: EnvApi): Servicos {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 1 });
  const prisma = new PrismaClient({ adapter }) as unknown as PrismaService;
  const notificacoes = new NotificacoesService(prisma);
  const divergencias = new DivergenciasService(prisma, notificacoes);
  return {
    prisma,
    usuarios: new UsuariosService(prisma),
    notificacoes,
    divergencias,
    importacoes: new ImportacoesService(prisma, divergencias),
    metricas: new MetricasService(prisma),
    notas: new NotasService(prisma),
  };
}

function responder(c: Ctx, resultado: unknown, status: 200 | 201 = 200) {
  if (resultado instanceof Paginado) return c.json({ data: resultado.itens, meta: resultado.meta }, status);
  return c.json({ data: resultado ?? null }, status);
}

function mensagens(erros: ValidationError[], prefixo = ''): string[] {
  return erros.flatMap((e) => [
    ...Object.values(e.constraints ?? {}).map((m) => prefixo + m),
    ...mensagens(e.children ?? [], `${prefixo}${e.property}.`),
  ]);
}

/** Mesmo comportamento do ValidationPipe do Nest (whitelist, forbidNonWhitelisted, transform). */
async function validar<T extends object>(classe: new () => T, dados: unknown): Promise<T> {
  const objeto = plainToInstance(classe, dados ?? {});
  const erros = await validate(objeto, { whitelist: true, forbidNonWhitelisted: true });
  if (erros.length) throw new BadRequestException(mensagens(erros));
  return objeto;
}

async function corpo(c: Ctx): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function inteiro(valor: string | undefined): number {
  if (!valor || !/^-?\d+$/.test(valor)) {
    throw new BadRequestException('Validation failed (numeric string is expected)');
  }
  return Number(valor);
}

/** Lê o multipart: campos de texto e arquivos (no mesmo formato que o multer entrega no Nest). */
async function multipart(c: Ctx, campo: string, maximo: number, maxBytes: number) {
  // Como no Nest, as rotas com arquivo também aceitam só JSON (sem anexos).
  if ((c.req.header('Content-Type') ?? '').includes('application/json')) {
    return { campos: (await corpo(c)) as Record<string, string>, arquivos: [] as ArquivoRecebido[] };
  }
  const form = await c.req.parseBody({ all: true });
  const campos: Record<string, string> = {};
  const arquivos: ArquivoRecebido[] = [];
  for (const [chave, valor] of Object.entries(form)) {
    const valores = Array.isArray(valor) ? valor : [valor];
    for (const v of valores) {
      if (typeof v === 'string') {
        campos[chave] = v;
      } else if (chave === campo) {
        if (v.size > maxBytes) throw new HttpException({ message: 'File too large' }, 413);
        arquivos.push({
          originalname: v.name,
          mimetype: v.type,
          size: v.size,
          buffer: Buffer.from(await v.arrayBuffer()),
        });
      } else {
        throw new BadRequestException(`Unexpected field - ${chave}`);
      }
    }
  }
  if (arquivos.length > maximo) throw new BadRequestException('Too many files');
  return { campos, arquivos };
}

function exigirPerfil(c: Ctx, perfis: Perfil[]) {
  if (!perfis.includes(c.get('usuario').perfil)) {
    throw new ForbiddenException('Seu perfil não tem acesso a esta ação');
  }
}

function salvarUnico(mensagem: string) {
  return (e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(mensagem);
    }
    throw e;
  };
}

function segundos(expira: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(expira.trim());
  if (!m) return 8 * 3600;
  const n = Number(m[1]);
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2] || 's']!;
}

// ---------- Aplicação ----------

export const api = new Hono<Ambiente>().basePath('/api');

api.use('*', async (c, next) => {
  const s = criarServicos(c.env);
  c.set('s', s);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(s.prisma.$disconnect());
  }
});

api.onError((erro, c) => {
  if (erro instanceof HttpException) {
    const status = erro.getStatus();
    const resposta = erro.getResponse();
    let mensagem = erro.message;
    let detalhes: unknown;
    if (typeof resposta === 'object') {
      const msg = resposta['message'];
      if (Array.isArray(msg)) {
        mensagem = 'Dados inválidos';
        detalhes = msg;
      } else if (typeof msg === 'string') {
        mensagem = msg;
      }
    }
    return c.json(
      { error: { status, mensagem, ...(detalhes ? { detalhes } : {}) } },
      status as 400 | 401 | 403 | 404 | 409 | 413,
    );
  }
  console.error(erro);
  return c.json({ error: { status: 500, mensagem: 'Erro interno do servidor' } }, 500);
});

api.notFound((c) =>
  c.json(
    { error: { status: 404, mensagem: `Cannot ${c.req.method} ${c.req.path.replace(/^\/api/, '')}` } },
    404,
  ),
);

// Login é a única rota pública.
api.post('/auth/login', async (c) => {
  const dto = await validar(LoginDto, await corpo(c));
  const usuario = await c.get('s').prisma.usuario.findUnique({
    where: { email: dto.email.toLowerCase() },
    include: { setor: true },
  });
  if (!usuario || !usuario.ativo || !(await conferirSenha(dto.senha, usuario.senhaHash))) {
    throw new UnauthorizedException('E-mail ou senha inválidos');
  }
  const agora = Math.floor(Date.now() / 1000);
  const token = await sign(
    {
      sub: usuario.id,
      perfil: usuario.perfil,
      iat: agora,
      exp: agora + segundos(c.env.JWT_EXPIRES_IN ?? '8h'),
    },
    c.env.JWT_SECRET,
    'HS256',
  );
  return responder(c, { token, usuario: usuarioPublico(usuario) });
});

// Daqui em diante, toda rota exige o token.
api.use('*', async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  let id: number;
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    id = Number(payload['sub']);
  } catch {
    throw new UnauthorizedException('Faça login para continuar');
  }
  const usuario = await c.get('s').prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.ativo) throw new UnauthorizedException('Usuário inativo ou inexistente');
  c.set('usuario', {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    setorId: usuario.setorId,
  });
  await next();
});

api.get('/auth/me', async (c) => {
  const usuario = await c.get('s').prisma.usuario.findUniqueOrThrow({
    where: { id: c.get('usuario').id },
    include: { setor: true },
  });
  return responder(c, usuarioPublico(usuario));
});

// Usuários
api.get('/usuarios', async (c) =>
  responder(c, await c.get('s').usuarios.listar(await validar(FiltroUsuariosDto, c.req.query()))),
);
api.post('/usuarios', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  return responder(c, await c.get('s').usuarios.criar(await validar(CriarUsuarioDto, await corpo(c))), 201);
});
api.patch('/usuarios/:id', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const id = inteiro(c.req.param('id'));
  return responder(
    c,
    await c.get('s').usuarios.atualizar(id, await validar(AtualizarUsuarioDto, await corpo(c))),
  );
});

// Setores
api.get('/setores', async (c) =>
  responder(
    c,
    await c.get('s').prisma.setor.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { usuarios: { where: { ativo: true } } } } },
    }),
  ),
);
api.post('/setores', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const dto = await validar(CriarSetorDto, await corpo(c));
  const setor = await c
    .get('s')
    .prisma.setor.create({
      data: { nome: dto.nome.trim(), descricao: dto.descricao?.trim() || null, slaDias: dto.slaDias },
    })
    .catch(salvarUnico('Já existe um setor com esse nome'));
  return responder(c, setor, 201);
});
api.patch('/setores/:id', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const id = inteiro(c.req.param('id'));
  const dto = await validar(AtualizarSetorDto, await corpo(c));
  const setor = await c
    .get('s')
    .prisma.setor.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        descricao: dto.descricao?.trim(),
        slaDias: dto.slaDias,
        ativo: dto.ativo,
      },
    })
    .catch(salvarUnico('Já existe um setor com esse nome'));
  return responder(c, setor);
});

// Tipos de divergência
api.get('/tipos-divergencia', async (c) =>
  responder(
    c,
    await c.get('s').prisma.tipoDivergencia.findMany({
      orderBy: { nome: 'asc' },
      include: { setorOrigem: { select: { id: true, nome: true } } },
    }),
  ),
);
api.post('/tipos-divergencia', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const dto = await validar(CriarTipoDivergenciaDto, await corpo(c));
  const tipo = await c
    .get('s')
    .prisma.tipoDivergencia.create({ data: { nome: dto.nome.trim(), setorOrigemId: dto.setorOrigemId } })
    .catch(salvarUnico('Já existe um tipo de divergência com esse nome'));
  return responder(c, tipo, 201);
});
api.patch('/tipos-divergencia/:id', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const id = inteiro(c.req.param('id'));
  const dto = await validar(AtualizarTipoDivergenciaDto, await corpo(c));
  const tipo = await c
    .get('s')
    .prisma.tipoDivergencia.update({
      where: { id },
      data: { nome: dto.nome?.trim(), setorOrigemId: dto.setorOrigemId, ativo: dto.ativo },
    })
    .catch(salvarUnico('Já existe um tipo de divergência com esse nome'));
  return responder(c, tipo);
});

// Notas fiscais
const MAX_XMLS = 500;
const MAX_XML_BYTES = 5 * 1024 * 1024;
api.post('/notas/importar', async (c) => {
  exigirPerfil(c, FISCAIS);
  const { arquivos } = await multipart(c, 'arquivos', MAX_XMLS, MAX_XML_BYTES);
  if (arquivos.length === 0) throw new BadRequestException('Envie ao menos um arquivo XML');
  return responder(c, await c.get('s').notas.importar(arquivos, c.get('usuario').id), 201);
});
api.get('/notas', async (c) => {
  exigirPerfil(c, FISCAIS);
  return responder(c, await c.get('s').notas.listar(await validar(FiltroNotasDto, c.req.query())));
});
api.get('/notas/:id', async (c) => {
  exigirPerfil(c, FISCAIS);
  return responder(c, await c.get('s').notas.detalhar(inteiro(c.req.param('id'))));
});
api.get('/notas/:id/xml', async (c) => {
  exigirPerfil(c, FISCAIS);
  const nota = await c.get('s').notas.xml(inteiro(c.req.param('id')));
  return c.body(nota.xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nota.chaveAcesso}.xml"`,
  });
});

// Importação CSV
function exigirCsv(arquivos: ArquivoRecebido[]): Buffer {
  const arquivo = arquivos[0];
  if (!arquivo) throw new BadRequestException('Envie o arquivo CSV');
  if (!/\.(csv|txt)$/i.test(arquivo.originalname)) {
    throw new BadRequestException('Envie um arquivo .csv separado por ponto e vírgula');
  }
  return arquivo.buffer;
}
async function lote(c: Ctx) {
  exigirPerfil(c, FISCAIS);
  const { campos, arquivos } = await multipart(c, 'arquivo', 1, 2 * 1024 * 1024);
  return { conteudo: exigirCsv(arquivos), padroes: await validar(PadroesLoteDto, campos) };
}
api.post('/importacoes/csv/previa', async (c) => {
  const { conteudo, padroes } = await lote(c);
  return responder(c, await c.get('s').importacoes.previa(conteudo, padroes, c.get('usuario')));
});
api.post('/importacoes/csv', async (c) => {
  const { conteudo, padroes } = await lote(c);
  return responder(c, await c.get('s').importacoes.confirmar(conteudo, padroes, c.get('usuario')), 201);
});

// Divergências
api.post('/divergencias', async (c) => {
  exigirPerfil(c, FISCAIS);
  const dto = await validar(CriarDivergenciaDto, await corpo(c));
  return responder(c, await c.get('s').divergencias.criar(dto, c.get('usuario')), 201);
});
api.get('/divergencias', async (c) =>
  responder(
    c,
    await c
      .get('s')
      .divergencias.listar(await validar(FiltroDivergenciasDto, c.req.query()), c.get('usuario')),
  ),
);
api.get('/divergencias/contadores', async (c) =>
  responder(c, await c.get('s').divergencias.contadores(c.get('usuario'))),
);
api.get('/divergencias/anexos/:anexoId', async (c) => {
  const anexo = await c.get('s').divergencias.baixarAnexo(inteiro(c.req.param('anexoId')), c.get('usuario'));
  return c.body(new Uint8Array(anexo.conteudo), 200, {
    'Content-Type': anexo.tipoConteudo,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(anexo.nomeArquivo)}"`,
    'X-Conteudo-Sha256': anexo.sha256,
  });
});
api.get('/divergencias/:id', async (c) =>
  responder(c, await c.get('s').divergencias.detalhar(inteiro(c.req.param('id')), c.get('usuario'))),
);
api.post('/divergencias/:id/assumir', async (c) =>
  responder(c, await c.get('s').divergencias.assumir(inteiro(c.req.param('id')), c.get('usuario'))),
);
api.put('/divergencias/:id/rascunho', async (c) => {
  const id = inteiro(c.req.param('id'));
  const dto = await validar(RascunhoDto, await corpo(c));
  return responder(c, await c.get('s').divergencias.salvarRascunho(id, dto, c.get('usuario')));
});
api.post('/divergencias/:id/devolver', async (c) => {
  const id = inteiro(c.req.param('id'));
  const { campos, arquivos } = await multipart(c, 'arquivos', MAX_ANEXOS, MAX_ANEXO_BYTES);
  const dto = await validar(DevolverDto, campos);
  return responder(c, await c.get('s').divergencias.devolver(id, dto, arquivos, c.get('usuario')));
});
api.post('/divergencias/:id/concluir', async (c) => {
  exigirPerfil(c, FISCAIS);
  const id = inteiro(c.req.param('id'));
  const dto = await validar(ConcluirDto, await corpo(c));
  return responder(c, await c.get('s').divergencias.concluir(id, dto, c.get('usuario')));
});
api.post('/divergencias/:id/reabrir', async (c) => {
  exigirPerfil(c, FISCAIS);
  const id = inteiro(c.req.param('id'));
  const dto = await validar(ReabrirDto, await corpo(c));
  return responder(c, await c.get('s').divergencias.reabrir(id, dto, c.get('usuario')));
});
api.post('/divergencias/:id/redistribuir', async (c) => {
  exigirPerfil(c, FISCAIS);
  const id = inteiro(c.req.param('id'));
  const dto = await validar(RedistribuirDto, await corpo(c));
  return responder(c, await c.get('s').divergencias.redistribuir(id, dto, c.get('usuario')));
});
api.post('/divergencias/:id/anexos', async (c) => {
  const id = inteiro(c.req.param('id'));
  const categoria = c.req.query('categoria');
  if (categoria !== undefined && !Object.values(CategoriaAnexo).includes(categoria as CategoriaAnexo)) {
    throw new BadRequestException(`Validation failed (enum string is expected)`);
  }
  const { arquivos } = await multipart(c, 'arquivos', MAX_ANEXOS, MAX_ANEXO_BYTES);
  const resultado = await c
    .get('s')
    .divergencias.anexar(
      id,
      arquivos,
      (categoria as CategoriaAnexo | undefined) ?? 'APOIO',
      c.get('usuario'),
    );
  return responder(c, resultado, 201);
});

// Notificações
api.get('/notificacoes', async (c) =>
  responder(c, await c.get('s').notificacoes.minhas(c.get('usuario').id)),
);
api.post('/notificacoes/lidas', async (c) =>
  responder(c, await c.get('s').notificacoes.marcarLidas(c.get('usuario').id)),
);
api.get('/notificacoes/configuracoes', async (c) =>
  responder(c, await c.get('s').notificacoes.configuracoes()),
);
api.patch('/notificacoes/configuracoes/:evento', async (c) => {
  exigirPerfil(c, ['ADMIN']);
  const evento = c.req.param('evento') as EventoNotificacao;
  if (!Object.values(EventoNotificacao).includes(evento)) {
    throw new BadRequestException('Validation failed (enum string is expected)');
  }
  const dto = await validar(ConfigurarAvisoDto, await corpo(c));
  return responder(c, await c.get('s').notificacoes.configurar(evento, dto.ativo));
});

// Métricas
api.get('/metricas', async (c) => {
  exigirPerfil(c, FISCAIS);
  return responder(c, await c.get('s').metricas.relatorio(await validar(FiltroMetricasDto, c.req.query())));
});
api.get('/metricas/painel', async (c) => {
  exigirPerfil(c, FISCAIS);
  return responder(c, await c.get('s').metricas.painel());
});
