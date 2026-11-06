import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prepararAnexos, type ArquivoRecebido } from '../anexos/arquivos.js';
import { dataDoDia, fimDoPrazo, hojeBrasilia, horasEntre, somarDias } from '../common/datas.js';
import { apenasDigitos, normalizarNumero } from '../common/documentos.js';
import { Paginado } from '../common/envelope.interceptor.js';
import type { UsuarioAutenticado } from '../common/usuario-atual.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  AcaoMovimentacao,
  CategoriaAnexo,
  Prioridade,
  StatusDivergencia,
} from '../generated/prisma/enums.js';
import { NotificacoesService } from '../notificacoes/notificacoes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ConcluirDto,
  CriarDivergenciaDto,
  DevolverDto,
  FiltroDivergenciasDto,
  NotaManualDto,
  RascunhoDto,
  ReabrirDto,
  RedistribuirDto,
} from './dto/divergencias.dto.js';
import {
  estaAtrasada,
  formatarProtocolo,
  PERFIS_FISCAIS,
  PERFIS_GESTAO,
  proximoStatus,
  RegraViolada,
  statusDaNota,
  type AcaoDivergencia,
} from './regras.js';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

const USUARIO_RESUMO = { select: { id: true, nome: true, email: true, setorId: true } } as const;

const NOTA_RESUMO = {
  select: {
    id: true,
    numero: true,
    serie: true,
    chaveAcesso: true,
    emitenteNome: true,
    emitenteCnpj: true,
    valorTotal: true,
    dataEmissao: true,
    pedidoCompra: true,
  },
} as const;

const INCLUDE_LISTA = {
  notaFiscal: NOTA_RESUMO,
  tipo: { select: { id: true, nome: true } },
  setor: { select: { id: true, nome: true } },
  solicitante: USUARIO_RESUMO,
  responsavelAtual: USUARIO_RESUMO,
  atribuicoes: { where: { fim: null }, select: { inicio: true }, take: 1 },
} satisfies Prisma.DivergenciaInclude;

const COM_O_SETOR: StatusDivergencia[] = ['PENDENTE', 'EM_TRATAMENTO'];

/** Dados para registrar uma divergência (cadastro manual, lote CSV ou notas importadas por XML). */
export interface NovaDivergencia {
  notaFiscalId: number;
  tipoId: number;
  setorId: number;
  responsavelId: number;
  prioridade: Prioridade;
  prazo: string;
  descricao: string;
  valorNf?: string | null;
  valorEsperado?: string | null;
  correcaoEsperada?: string | null;
}

@Injectable()
export class DivergenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  // ---------------------------------------------------------------- cadastro

  async criar(dto: CriarDivergenciaDto, usuario: UsuarioAutenticado) {
    if (!!dto.nota === !!dto.notaFiscalIds) {
      throw new BadRequestException('Informe os dados da nota ou selecione notas já importadas');
    }
    const destino = await this.validarDestino(this.prisma, dto, usuario);
    const prazo = this.prazoValido(dto.prazo, destino.setor.slaDias);

    const ids = await this.prisma.$transaction(async (tx) => {
      const notaIds = dto.nota ? [await this.localizarOuCriarNota(tx, dto.nota)] : dto.notaFiscalIds!;
      const existentes = await tx.notaFiscal.count({ where: { id: { in: notaIds } } });
      if (existentes !== notaIds.length) throw new NotFoundException('Uma ou mais notas não existem');

      const duplicada = await this.divergenciaAberta(tx, notaIds, dto.tipoId);
      if (duplicada) {
        throw new ConflictException(
          `Já existe a divergência ${duplicada.protocolo} aberta para a NF ${duplicada.notaFiscal.numero} com este tipo`,
        );
      }

      const criadas: number[] = [];
      for (const notaFiscalId of notaIds) {
        criadas.push(
          await this.registrar(
            tx,
            {
              notaFiscalId,
              tipoId: dto.tipoId,
              setorId: destino.setor.id,
              responsavelId: destino.responsavel.id,
              prioridade: dto.prioridade ?? 'NORMAL',
              prazo,
              descricao: dto.descricao,
              valorNf: dto.valorNf,
              valorEsperado: dto.valorEsperado,
              correcaoEsperada: dto.correcaoEsperada,
            },
            usuario.id,
          ),
        );
      }
      return criadas;
    });

    const agora = new Date();
    const divergencias = await this.prisma.divergencia.findMany({
      where: { id: { in: ids } },
      include: INCLUDE_LISTA,
      orderBy: { id: 'asc' },
    });
    return divergencias.map((d) => this.resumo(d, agora));
  }

  /**
   * Grava a divergência com protocolo, primeira atribuição, movimentação de cadastro e aviso
   * ao responsável. Usado pelo cadastro e pela importação em lote, sempre dentro de uma transação.
   */
  async registrar(tx: Tx, nova: NovaDivergencia, solicitanteId: number): Promise<number> {
    const agora = new Date();
    const protocolo = await this.proximoProtocolo(tx, agora);
    const responsavel = await tx.usuario.findUniqueOrThrow({ where: { id: nova.responsavelId } });
    const setor = await tx.setor.findUniqueOrThrow({ where: { id: nova.setorId } });
    const d = await tx.divergencia.create({
      data: {
        protocolo,
        notaFiscalId: nova.notaFiscalId,
        tipoId: nova.tipoId,
        setorId: nova.setorId,
        descricao: nova.descricao.trim(),
        valorNf: nova.valorNf?.trim() || null,
        valorEsperado: nova.valorEsperado?.trim() || null,
        correcaoEsperada: nova.correcaoEsperada?.trim() || null,
        prioridade: nova.prioridade,
        prazo: dataDoDia(nova.prazo),
        solicitanteId,
        responsavelAtualId: responsavel.id,
        abertaEm: agora,
        atribuicoes: { create: { responsavelId: responsavel.id, setorId: nova.setorId, inicio: agora } },
        movimentacoes: {
          create: {
            autorId: solicitanteId,
            acao: 'CADASTRO',
            statusNovo: 'PENDENTE',
            texto: nova.descricao.trim(),
            destinoId: responsavel.id,
            setorDestino: setor.nome,
            prazoNovo: dataDoDia(nova.prazo),
            criadaEm: agora,
          },
        },
      },
    });
    await tx.notaFiscal.update({ where: { id: nova.notaFiscalId }, data: { status: 'EM_AJUSTE' } });
    await this.notificacoes.registrar(
      tx,
      'NOVA_ATRIBUICAO',
      [responsavel.id],
      d,
      `Nova divergência para tratar até ${nova.prazo.split('-').toReversed().join('/')}`,
    );
    return d.id;
  }

  /** Confere setor e responsável; fora do setor só com perfil de gestão (critério de aceite). */
  async validarDestino(
    db: Db,
    dto: { tipoId: number; setorId: number; responsavelId: number },
    usuario: UsuarioAutenticado,
  ) {
    const [tipo, setor, responsavel] = await Promise.all([
      db.tipoDivergencia.findUnique({ where: { id: dto.tipoId } }),
      db.setor.findUnique({ where: { id: dto.setorId } }),
      db.usuario.findUnique({ where: { id: dto.responsavelId } }),
    ]);
    if (!tipo || !tipo.ativo) throw new BadRequestException('Tipo de divergência inválido');
    if (!setor || !setor.ativo) throw new BadRequestException('Setor inválido ou inativo');
    this.conferirResponsavel(responsavel, setor, usuario);
    return { tipo, setor, responsavel: responsavel! };
  }

  conferirResponsavel(
    responsavel: { ativo: boolean; setorId: number | null } | null,
    setor: { id: number; nome: string },
    usuario: UsuarioAutenticado,
  ) {
    if (!responsavel || !responsavel.ativo) throw new BadRequestException('Responsável inválido ou inativo');
    if (responsavel.setorId !== setor.id && !PERFIS_GESTAO.includes(usuario.perfil)) {
      throw new BadRequestException(
        `O responsável não pertence ao setor ${setor.nome}; somente o gestor pode designar fora do setor`,
      );
    }
  }

  prazoValido(prazo: string | undefined, slaDias: number): string {
    const hoje = hojeBrasilia();
    if (!prazo) return somarDias(hoje, slaDias);
    if (prazo < hoje) throw new BadRequestException('O prazo não pode ser anterior a hoje');
    return prazo;
  }

  /** Localiza a NF pela chave ou por CNPJ + série + número; cria se não existir. */
  async localizarOuCriarNota(
    tx: Tx,
    nota: NotaManualDto,
    origem: 'MANUAL' | 'CSV' = 'MANUAL',
    importacaoId?: number,
  ) {
    const cnpj = apenasDigitos(nota.emitenteCnpj);
    const chave = nota.chaveAcesso ? apenasDigitos(nota.chaveAcesso) : null;
    const numero = normalizarNumero(nota.numero);
    const serie = normalizarNumero(nota.serie);
    const existente = await tx.notaFiscal.findFirst({
      where: {
        OR: [...(chave ? [{ chaveAcesso: chave }] : []), { emitenteCnpj: cnpj, serie, numero }],
      },
      select: { id: true },
    });
    if (existente) return existente.id;
    const criada = await tx.notaFiscal.create({
      data: {
        numero,
        serie,
        chaveAcesso: chave,
        modelo: chave ? chave.slice(20, 22) : null,
        emitenteCnpj: cnpj,
        emitenteNome: nota.emitenteNome.trim(),
        valorTotal: nota.valorTotal,
        dataEmissao: nota.dataEmissao ? new Date(`${nota.dataEmissao}T12:00:00-03:00`) : null,
        destinatarioDoc: nota.destinatarioDoc ? apenasDigitos(nota.destinatarioDoc) : null,
        pedidoCompra: nota.pedidoCompra?.trim() || null,
        unidade: nota.unidade?.trim() || null,
        centroCusto: nota.centroCusto?.trim() || null,
        origem,
        importacaoId,
      },
    });
    return criada.id;
  }

  /** Mesma NF + mesmo tipo ainda não concluída = ocorrência duplicada. */
  divergenciaAberta(db: Db, notaFiscalIds: number[], tipoId: number) {
    return db.divergencia.findFirst({
      where: { notaFiscalId: { in: notaFiscalIds }, tipoId, status: { not: 'CONCLUIDA' } },
      select: { protocolo: true, notaFiscal: { select: { numero: true } } },
    });
  }

  private async proximoProtocolo(tx: Tx, agora: Date) {
    const ano = Number(hojeBrasilia(agora).slice(0, 4));
    const [linha] = await tx.$queryRaw<{ ultimo: number }[]>`
      INSERT INTO nexo."SequenciaProtocolo" (ano, ultimo) VALUES (${ano}, 1)
      ON CONFLICT (ano) DO UPDATE SET ultimo = nexo."SequenciaProtocolo".ultimo + 1
      RETURNING ultimo`;
    return formatarProtocolo(ano, linha!.ultimo);
  }

  // ---------------------------------------------------------------- consulta

  async listar(filtro: FiltroDivergenciasDto, usuario: UsuarioAutenticado) {
    const where = this.filtroLista(filtro, usuario);
    const ordem: Prisma.DivergenciaOrderByWithRelationInput[] =
      filtro.escopo === 'todas'
        ? [{ abertaEm: 'desc' }, { id: 'desc' }]
        : [{ prazo: 'asc' }, { prioridade: 'desc' }, { id: 'asc' }];
    const [total, itens] = await this.prisma.$transaction([
      this.prisma.divergencia.count({ where }),
      this.prisma.divergencia.findMany({
        where,
        include: INCLUDE_LISTA,
        orderBy: ordem,
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
    ]);
    const agora = new Date();
    return new Paginado(
      itens.map((d) => this.resumo(d, agora)),
      { pagina: filtro.pagina, porPagina: filtro.porPagina, total },
    );
  }

  private filtroLista(filtro: FiltroDivergenciasDto, usuario: UsuarioAutenticado) {
    const fiscal = PERFIS_FISCAIS.includes(usuario.perfil);
    if (filtro.escopo === 'validacao' && !fiscal) {
      throw new ForbiddenException('A validação é feita pelo Fiscal ou pelo gestor');
    }
    const busca = filtro.busca?.trim();
    const digitos = busca ? apenasDigitos(busca) : '';
    const e: Prisma.DivergenciaWhereInput[] = [];

    if (filtro.escopo === 'minhas') e.push({ responsavelAtualId: usuario.id, status: { in: COM_O_SETOR } });
    if (filtro.escopo === 'validacao') e.push({ status: 'DEVOLVIDA' });
    // Tratador consulta a central apenas do próprio setor (ou o que passou por ele).
    if (filtro.escopo === 'todas' && !fiscal) {
      e.push({
        OR: [
          ...(usuario.setorId ? [{ setorId: usuario.setorId }] : []),
          { atribuicoes: { some: { responsavelId: usuario.id } } },
        ],
      });
    }
    if (filtro.status) e.push({ status: filtro.status });
    if (filtro.atrasadas) e.push({ status: { in: COM_O_SETOR }, prazo: { lt: dataDoDia(hojeBrasilia()) } });
    if (filtro.prioridade) e.push({ prioridade: filtro.prioridade });
    if (filtro.setorId) e.push({ setorId: filtro.setorId });
    if (filtro.responsavelId) e.push({ responsavelAtualId: filtro.responsavelId });
    if (filtro.tipoId) e.push({ tipoId: filtro.tipoId });
    if (filtro.notaFiscalId) e.push({ notaFiscalId: filtro.notaFiscalId });
    if (busca) {
      e.push({
        OR: [
          { protocolo: { contains: busca, mode: 'insensitive' } },
          ...(digitos ? [{ notaFiscal: { numero: { contains: normalizarNumero(digitos) } } }] : []),
          { notaFiscal: { emitenteNome: { contains: busca, mode: 'insensitive' } } },
          ...(digitos.length >= 4
            ? [
                { notaFiscal: { chaveAcesso: { contains: digitos } } },
                { notaFiscal: { emitenteCnpj: { contains: digitos } } },
              ]
            : []),
        ],
      });
    }
    return { AND: e } satisfies Prisma.DivergenciaWhereInput;
  }

  /** Contadores da central e da fila do responsável. */
  async contadores(usuario: UsuarioAutenticado) {
    const hoje = dataDoDia(hojeBrasilia());
    const fiscal = PERFIS_FISCAIS.includes(usuario.perfil);
    const escopo: Prisma.DivergenciaWhereInput = fiscal
      ? {}
      : { OR: [{ setorId: usuario.setorId ?? -1 }, { responsavelAtualId: usuario.id }] };
    const minhas: Prisma.DivergenciaWhereInput = {
      responsavelAtualId: usuario.id,
      status: { in: COM_O_SETOR },
    };
    const seteDias = new Date(Date.now() - 7 * 86_400_000);
    const [pendentes, devolvidas, atrasadas, minhasAbertas, vencendo, resolvidasSemana] =
      await this.prisma.$transaction([
        this.prisma.divergencia.count({ where: { ...escopo, status: 'PENDENTE' } }),
        this.prisma.divergencia.count({ where: { ...escopo, status: 'DEVOLVIDA' } }),
        this.prisma.divergencia.count({
          where: { ...escopo, status: { in: COM_O_SETOR }, prazo: { lt: hoje } },
        }),
        this.prisma.divergencia.count({ where: minhas }),
        this.prisma.divergencia.count({
          where: { ...minhas, prazo: { lte: dataDoDia(somarDias(hojeBrasilia(), 1)) } },
        }),
        this.prisma.movimentacao.count({
          where: { autorId: usuario.id, acao: 'DEVOLUCAO', criadaEm: { gte: seteDias } },
        }),
      ]);
    return { pendentes, devolvidas, atrasadas, minhas: minhasAbertas, vencendo, resolvidasSemana };
  }

  async detalhar(id: number, usuario: UsuarioAutenticado) {
    const d = await this.prisma.divergencia.findUnique({
      where: { id },
      include: {
        ...INCLUDE_LISTA,
        notaFiscal: {
          select: {
            ...NOTA_RESUMO.select,
            modelo: true,
            destinatarioDoc: true,
            destinatarioNome: true,
            naturezaOperacao: true,
            unidade: true,
            centroCusto: true,
            origem: true,
            status: true,
          },
        },
        movimentacoes: {
          orderBy: [{ criadaEm: 'asc' }, { id: 'asc' }],
          include: {
            autor: USUARIO_RESUMO,
            destino: USUARIO_RESUMO,
            anexos: { select: { id: true, nomeArquivo: true, tamanho: true } },
          },
        },
        anexos: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            categoria: true,
            nomeArquivo: true,
            tipoConteudo: true,
            tamanho: true,
            sha256: true,
            criadoEm: true,
            usuario: { select: { id: true, nome: true } },
          },
        },
      },
    });
    if (!d) throw new NotFoundException('Divergência não encontrada');

    const atribuicoes = await this.prisma.atribuicao.findMany({
      where: { divergenciaId: id },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
      include: { responsavel: { select: { id: true, nome: true } }, setor: true },
    });
    if (!this.podeVer(usuario, d, atribuicoes)) {
      throw new ForbiddenException('Esta divergência é de outro setor');
    }

    const agora = new Date();
    return {
      ...this.resumo(d, agora),
      prazoOriginal: d.movimentacoes.find((m) => m.acao === 'CADASTRO')?.prazoNovo ?? d.prazo,
      atribuicoes: atribuicoes.map((a) => ({ ...a, horas: arredondar(horasEntre(a.inicio, a.fim, agora)) })),
    };
  }

  podeVer(
    usuario: UsuarioAutenticado,
    d: { setorId: number; solicitanteId: number },
    atribuicoes: { responsavelId: number }[],
  ) {
    return (
      PERFIS_FISCAIS.includes(usuario.perfil) ||
      d.setorId === usuario.setorId ||
      d.solicitanteId === usuario.id ||
      atribuicoes.some((a) => a.responsavelId === usuario.id)
    );
  }

  // ---------------------------------------------------------------- anexos

  async anexar(
    id: number,
    arquivos: ArquivoRecebido[] | undefined,
    categoria: CategoriaAnexo,
    usuario: UsuarioAutenticado,
  ) {
    const preparados = prepararAnexos(arquivos);
    if (preparados.length === 0) throw new BadRequestException('Envie ao menos um arquivo');
    const d = await this.prisma.divergencia.findUnique({ where: { id }, include: { atribuicoes: true } });
    if (!d) throw new NotFoundException('Divergência não encontrada');
    const podeAnexar = PERFIS_FISCAIS.includes(usuario.perfil) || d.responsavelAtualId === usuario.id;
    if (!podeAnexar)
      throw new ForbiddenException('Somente o Fiscal ou o responsável designado anexa arquivos');
    if (d.status === 'CONCLUIDA') throw new ConflictException('A divergência já foi concluída');
    await this.prisma.anexo.createMany({
      data: preparados.map((a) => ({ ...a, divergenciaId: id, usuarioId: usuario.id, categoria })),
    });
    return this.detalhar(id, usuario);
  }

  async baixarAnexo(id: number, usuario: UsuarioAutenticado) {
    const anexo = await this.prisma.anexo.findUnique({
      where: { id },
      include: { divergencia: { include: { atribuicoes: { select: { responsavelId: true } } } } },
    });
    if (!anexo) throw new NotFoundException('Anexo não encontrado');
    if (!this.podeVer(usuario, anexo.divergencia, anexo.divergencia.atribuicoes)) {
      throw new ForbiddenException('Esta divergência é de outro setor');
    }
    return anexo;
  }

  // ---------------------------------------------------------------- tratativa

  assumir(id: number, usuario: UsuarioAutenticado) {
    return this.executar(id, 'assumir', usuario, async (tx, ctx) => {
      await this.movimentar(tx, ctx, 'ASSUNCAO', 'Solicitação assumida para regularização.');
      return {};
    });
  }

  async salvarRascunho(id: number, dto: RascunhoDto, usuario: UsuarioAutenticado) {
    const d = await this.prisma.divergencia.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Divergência não encontrada');
    this.validarRegra('rascunho', d, usuario);
    await this.prisma.divergencia.update({
      where: { id },
      data: { rascunho: dto.texto, tipoSolucao: dto.tipoSolucao ?? d.tipoSolucao },
    });
    return this.detalhar(id, usuario);
  }

  devolver(
    id: number,
    dto: DevolverDto,
    arquivos: ArquivoRecebido[] | undefined,
    usuario: UsuarioAutenticado,
  ) {
    const evidencias = prepararAnexos(arquivos);
    return this.executar(id, 'devolver', usuario, async (tx, ctx) => {
      await this.fecharAtribuicao(tx, id, ctx.agora, 'DEVOLVIDA');
      const mov = await this.movimentar(tx, ctx, 'DEVOLUCAO', dto.texto);
      if (evidencias.length) {
        await tx.anexo.createMany({
          data: evidencias.map((a) => ({
            ...a,
            divergenciaId: id,
            usuarioId: usuario.id,
            movimentacaoId: mov.id,
            categoria: 'EVIDENCIA' as const,
          })),
        });
      }
      await this.notificacoes.registrar(
        tx,
        'DEVOLUCAO',
        [ctx.atual.solicitanteId],
        ctx.atual,
        'Correção devolvida; aguardando validação do Fiscal',
      );
      return {
        devolutiva: dto.texto.trim(),
        tipoSolucao: dto.tipoSolucao ?? null,
        rascunho: null,
        devolvidaEm: ctx.agora,
      };
    });
  }

  concluir(id: number, dto: ConcluirDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'concluir', usuario, async (tx, ctx) => {
      await this.movimentar(tx, ctx, 'CONCLUSAO', dto.parecer);
      return { parecer: dto.parecer.trim(), concluidaEm: ctx.agora };
    });
  }

  reabrir(id: number, dto: ReabrirDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'reabrir', usuario, async (tx, ctx) => {
      const setor = await tx.setor.findUniqueOrThrow({ where: { id: ctx.atual.setorId } });
      const responsavelId = dto.responsavelId ?? ctx.atual.responsavelAtualId;
      if (!responsavelId) throw new BadRequestException('Informe o responsável');
      const responsavel = await tx.usuario.findUnique({ where: { id: responsavelId } });
      this.conferirResponsavel(responsavel, setor, usuario);
      const prazo = dto.prazo ? this.prazoValido(dto.prazo, setor.slaDias) : null;
      const mesmo = responsavelId === ctx.atual.responsavelAtualId;
      ctx.status = mesmo ? 'EM_TRATAMENTO' : 'PENDENTE';

      await tx.atribuicao.create({
        data: { divergenciaId: id, responsavelId, setorId: setor.id, inicio: ctx.agora },
      });
      await this.movimentar(tx, ctx, 'REABERTURA', dto.motivo, {
        destinoId: responsavelId,
        setorDestino: setor.nome,
        ...(prazo ? { prazoAnterior: ctx.atual.prazo, prazoNovo: dataDoDia(prazo) } : {}),
      });
      const gestores = await tx.usuario.findMany({
        where: { perfil: 'GESTOR', ativo: true, OR: [{ setorId: setor.id }, { setorId: null }] },
        select: { id: true },
      });
      await this.notificacoes.registrar(
        tx,
        'ESCALONAMENTO',
        [responsavelId, ...gestores.map((g) => g.id)],
        ctx.atual,
        `Divergência reaberta pelo Fiscal: ${dto.motivo.trim().slice(0, 120)}`,
      );
      return {
        responsavelAtualId: responsavelId,
        reaberturas: { increment: 1 },
        ...(prazo ? { prazo: dataDoDia(prazo) } : {}),
      };
    });
  }

  redistribuir(id: number, dto: RedistribuirDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'redistribuir', usuario, async (tx, ctx) => {
      const setorId = dto.setorId ?? ctx.atual.setorId;
      const setor = await tx.setor.findUnique({ where: { id: setorId } });
      if (!setor || !setor.ativo) throw new BadRequestException('Setor inválido ou inativo');
      if (dto.responsavelId === ctx.atual.responsavelAtualId && setorId === ctx.atual.setorId) {
        throw new BadRequestException('A divergência já está com esse responsável');
      }
      const responsavel = await tx.usuario.findUnique({ where: { id: dto.responsavelId } });
      this.conferirResponsavel(responsavel, setor, usuario);
      const prazo = dto.prazo ? this.prazoValido(dto.prazo, setor.slaDias) : null;

      await this.fecharAtribuicao(tx, id, ctx.agora, 'REDISTRIBUIDA');
      await tx.atribuicao.create({
        data: { divergenciaId: id, responsavelId: dto.responsavelId, setorId, inicio: ctx.agora },
      });
      await this.movimentar(tx, ctx, 'REDISTRIBUICAO', dto.motivo, {
        destinoId: dto.responsavelId,
        setorDestino: setor.nome,
        ...(prazo ? { prazoAnterior: ctx.atual.prazo, prazoNovo: dataDoDia(prazo) } : {}),
      });
      await this.notificacoes.registrar(
        tx,
        'NOVA_ATRIBUICAO',
        [dto.responsavelId],
        ctx.atual,
        'Divergência redistribuída para você',
      );
      return {
        responsavelAtualId: dto.responsavelId,
        setorId,
        ...(prazo ? { prazo: dataDoDia(prazo) } : {}),
      };
    });
  }

  // ---------------------------------------------------------------- infraestrutura

  private validarRegra(
    acao: AcaoDivergencia,
    d: { status: StatusDivergencia; responsavelAtualId: number | null },
    usuario: UsuarioAutenticado,
  ): StatusDivergencia {
    try {
      return proximoStatus(acao, {
        status: d.status,
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        responsavelAtualId: d.responsavelAtualId,
      });
    } catch (e) {
      if (e instanceof RegraViolada) {
        throw e.tipo === 'permissao' ? new ForbiddenException(e.message) : new ConflictException(e.message);
      }
      throw e;
    }
  }

  /**
   * Executa uma ação dentro de uma transação: valida a regra, aplica os efeitos e troca o status
   * só se ninguém alterou a divergência antes (evita corrida entre duas pessoas).
   */
  private async executar(
    id: number,
    acao: AcaoDivergencia,
    usuario: UsuarioAutenticado,
    efeitos: (tx: Tx, ctx: ContextoExecucao) => Promise<Prisma.DivergenciaUncheckedUpdateManyInput>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const atual = await tx.divergencia.findUnique({ where: { id } });
      if (!atual) throw new NotFoundException('Divergência não encontrada');
      const ctx: ContextoExecucao = {
        atual,
        usuario,
        agora: new Date(),
        status: this.validarRegra(acao, atual, usuario),
      };

      const extra = await efeitos(tx, ctx);
      const { count } = await tx.divergencia.updateMany({
        where: { id, status: atual.status, responsavelAtualId: atual.responsavelAtualId },
        data: { ...extra, status: ctx.status },
      });
      if (count === 0) {
        throw new ConflictException('A divergência foi alterada por outra pessoa; recarregue a tela');
      }

      const statusDivergencias = await tx.divergencia.findMany({
        where: { notaFiscalId: atual.notaFiscalId },
        select: { status: true },
      });
      await tx.notaFiscal.update({
        where: { id: atual.notaFiscalId },
        data: { status: statusDaNota(statusDivergencias.map((s) => s.status)) },
      });
    });
    return this.detalhar(id, usuario);
  }

  private fecharAtribuicao(
    tx: Tx,
    divergenciaId: number,
    agora: Date,
    motivo: 'DEVOLVIDA' | 'REDISTRIBUIDA',
  ) {
    return tx.atribuicao.updateMany({
      where: { divergenciaId, fim: null },
      data: { fim: agora, motivoFim: motivo },
    });
  }

  private movimentar(
    tx: Tx,
    ctx: ContextoExecucao,
    acao: AcaoMovimentacao,
    texto: string,
    extra: Partial<Prisma.MovimentacaoUncheckedCreateInput> = {},
  ) {
    return tx.movimentacao.create({
      data: {
        divergenciaId: ctx.atual.id,
        autorId: ctx.usuario.id,
        acao,
        statusAnterior: ctx.atual.status,
        statusNovo: ctx.status,
        texto: texto.trim(),
        criadaEm: ctx.agora,
        ...extra,
      },
    });
  }

  private resumo<
    T extends {
      status: StatusDivergencia;
      prazo: Date;
      abertaEm: Date;
      concluidaEm: Date | null;
      atribuicoes: { inicio: Date }[];
    },
  >(d: T, agora: Date) {
    const { atribuicoes, ...resto } = d;
    const aberta = atribuicoes[0];
    const fimPrazo = fimDoPrazo(d.prazo);
    return {
      ...resto,
      atrasada: estaAtrasada(d.status, fimPrazo, agora),
      horasAberta: arredondar(horasEntre(d.abertaEm, d.concluidaEm, agora)),
      horasComResponsavelAtual: aberta ? arredondar(horasEntre(aberta.inicio, null, agora)) : null,
    };
  }
}

interface ContextoExecucao {
  atual: Prisma.DivergenciaGetPayload<object>;
  usuario: UsuarioAutenticado;
  agora: Date;
  /** Próximo status; a ação pode ajustá-lo (ex.: reabertura para outro responsável fica pendente). */
  status: StatusDivergencia;
}

function arredondar(horas: number): number {
  return Math.round(horas * 100) / 100;
}
