import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Paginado } from '../common/envelope.interceptor.js';
import type { UsuarioAutenticado } from '../common/usuario-atual.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { StatusDivergencia, TipoMensagem } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AceitarDivergenciaDto,
  CriarDivergenciasDto,
  DevolverDivergenciaDto,
  FiltroDivergenciasDto,
  RepassarDivergenciaDto,
  ResponderDivergenciaDto,
} from './dto/divergencias.dto.js';
import { horasEntre, proximoStatus, RegraViolada, statusDaNota, type AcaoDivergencia } from './regras.js';

type Tx = Prisma.TransactionClient;

const USUARIO_RESUMO = {
  select: { id: true, nome: true, setor: { select: { id: true, nome: true } } },
} as const;

const INCLUDE_LISTA = {
  notaFiscal: {
    select: { id: true, numero: true, serie: true, chaveAcesso: true, emitenteNome: true, valorTotal: true },
  },
  tipo: true,
  solicitante: USUARIO_RESUMO,
  responsavelAtual: USUARIO_RESUMO,
  atribuicoes: { where: { fim: null }, select: { inicio: true }, take: 1 },
} satisfies Prisma.DivergenciaInclude;

@Injectable()
export class DivergenciasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Marca as notas como divergentes e encaminha ao responsável; o relógio dele começa agora. */
  async criar(dto: CriarDivergenciasDto, usuario: UsuarioAutenticado) {
    const [tipo, responsavel, notas] = await Promise.all([
      this.prisma.tipoDivergencia.findUnique({ where: { id: dto.tipoId } }),
      this.responsavelValido(this.prisma, dto.responsavelId),
      this.prisma.notaFiscal.findMany({ where: { id: { in: dto.notaFiscalIds } }, select: { id: true } }),
    ]);
    if (!tipo || !tipo.ativo) throw new BadRequestException('Tipo de divergência inválido');
    if (notas.length !== dto.notaFiscalIds.length)
      throw new NotFoundException('Uma ou mais notas não existem');

    const agora = new Date();
    const ids = await this.prisma.$transaction(async (tx) => {
      const criadas: number[] = [];
      for (const notaFiscalId of dto.notaFiscalIds) {
        const d = await tx.divergencia.create({
          data: {
            notaFiscalId,
            tipoId: tipo.id,
            descricao: dto.descricao.trim(),
            solicitanteId: usuario.id,
            responsavelAtualId: responsavel.id,
            abertaEm: agora,
            atribuicoes: {
              create: { responsavelId: responsavel.id, setorId: responsavel.setorId, inicio: agora },
            },
            mensagens: {
              create: {
                autorId: usuario.id,
                tipo: 'SOLICITACAO',
                texto: dto.descricao.trim(),
                criadaEm: agora,
              },
            },
          },
        });
        criadas.push(d.id);
      }
      await tx.notaFiscal.updateMany({
        where: { id: { in: dto.notaFiscalIds } },
        data: { status: 'EM_AJUSTE' },
      });
      return criadas;
    });

    const divergencias = await this.prisma.divergencia.findMany({
      where: { id: { in: ids } },
      include: INCLUDE_LISTA,
    });
    return divergencias.map((d) => this.resumo(d, agora));
  }

  async listar(filtro: FiltroDivergenciasDto, usuario: UsuarioAutenticado) {
    if (filtro.escopo === 'todas' && usuario.perfil === 'RESPONSAVEL') {
      throw new ForbiddenException('Seu perfil só vê as próprias pendências');
    }
    const where: Prisma.DivergenciaWhereInput = {
      status: filtro.status,
      notaFiscalId: filtro.notaFiscalId,
      ...(filtro.setorId ? { responsavelAtual: { setorId: filtro.setorId } } : {}),
      ...(filtro.escopo === 'minhas' ? { responsavelAtualId: usuario.id } : {}),
      ...(filtro.escopo === 'solicitadas' ? { solicitanteId: usuario.id } : {}),
    };
    const [total, itens] = await this.prisma.$transaction([
      this.prisma.divergencia.count({ where }),
      this.prisma.divergencia.findMany({
        where,
        include: INCLUDE_LISTA,
        orderBy: [{ abertaEm: 'asc' }, { id: 'asc' }],
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

  async detalhar(id: number, usuario: UsuarioAutenticado) {
    const d = await this.prisma.divergencia.findUnique({
      where: { id },
      include: {
        ...INCLUDE_LISTA,
        notaFiscal: {
          select: {
            id: true,
            numero: true,
            serie: true,
            chaveAcesso: true,
            emitenteNome: true,
            emitenteCnpj: true,
            dataEmissao: true,
            valorTotal: true,
            status: true,
          },
        },
        mensagens: { orderBy: [{ criadaEm: 'asc' }, { id: 'asc' }], include: { autor: USUARIO_RESUMO } },
      },
    });
    if (!d) throw new NotFoundException('Divergência não encontrada');

    const atribuicoes = await this.prisma.atribuicao.findMany({
      where: { divergenciaId: id },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
      include: { responsavel: { select: { id: true, nome: true } }, setor: true },
    });

    const envolvido =
      usuario.perfil !== 'RESPONSAVEL' ||
      d.solicitanteId === usuario.id ||
      atribuicoes.some((a) => a.responsavelId === usuario.id);
    if (!envolvido) throw new ForbiddenException('Você não participa desta divergência');

    const agora = new Date();
    return {
      ...this.resumo(d, agora),
      atribuicoes: atribuicoes.map((a) => ({ ...a, horas: arredondar(horasEntre(a.inicio, a.fim, agora)) })),
    };
  }

  responder(id: number, dto: ResponderDivergenciaDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'responder', usuario, async (tx, agora) => {
      await this.fecharAtribuicao(tx, id, agora, 'RESPONDIDA');
      await this.mensagem(tx, id, usuario.id, dto.tipo, dto.texto, agora);
      return {};
    });
  }

  repassar(id: number, dto: RepassarDivergenciaDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'repassar', usuario, async (tx, agora, atual) => {
      if (dto.responsavelId === atual.responsavelAtualId) {
        throw new BadRequestException('A divergência já está com esse responsável');
      }
      const novo = await this.responsavelValido(tx, dto.responsavelId);
      await this.fecharAtribuicao(tx, id, agora, 'REPASSADA');
      await tx.atribuicao.create({
        data: { divergenciaId: id, responsavelId: novo.id, setorId: novo.setorId, inicio: agora },
      });
      await this.mensagem(tx, id, usuario.id, 'REPASSE', `Repassada para ${novo.nome}: ${dto.texto}`, agora);
      return { responsavelAtualId: novo.id };
    });
  }

  aceitar(id: number, dto: AceitarDivergenciaDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'aceitar', usuario, async (tx, agora) => {
      await this.mensagem(tx, id, usuario.id, 'ACEITE', dto.texto?.trim() || 'Ajuste aceito.', agora);
      return { resolvidaEm: agora };
    });
  }

  devolver(id: number, dto: DevolverDivergenciaDto, usuario: UsuarioAutenticado) {
    return this.executar(id, 'devolver', usuario, async (tx, agora, atual) => {
      const responsavelId = dto.responsavelId ?? atual.responsavelAtualId;
      if (!responsavelId) throw new BadRequestException('Informe o responsável');
      const responsavel = await this.responsavelValido(tx, responsavelId);
      await tx.atribuicao.create({
        data: {
          divergenciaId: id,
          responsavelId: responsavel.id,
          setorId: responsavel.setorId,
          inicio: agora,
        },
      });
      await this.mensagem(tx, id, usuario.id, 'DEVOLUCAO', dto.texto, agora);
      return { responsavelAtualId: responsavel.id };
    });
  }

  /**
   * Executa uma ação na divergência dentro de uma transação: valida a regra,
   * aplica os efeitos e troca o status só se ninguém mudou a divergência antes (evita corrida).
   */
  private async executar(
    id: number,
    acao: AcaoDivergencia,
    usuario: UsuarioAutenticado,
    efeitos: (
      tx: Tx,
      agora: Date,
      atual: { status: StatusDivergencia; responsavelAtualId: number | null },
    ) => Promise<Prisma.DivergenciaUncheckedUpdateManyInput>,
  ) {
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const atual = await tx.divergencia.findUnique({ where: { id } });
      if (!atual) throw new NotFoundException('Divergência não encontrada');

      let status: StatusDivergencia;
      try {
        status = proximoStatus(acao, {
          status: atual.status,
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          solicitanteId: atual.solicitanteId,
          responsavelAtualId: atual.responsavelAtualId,
        });
      } catch (e) {
        if (e instanceof RegraViolada) {
          throw e.tipo === 'permissao' ? new ForbiddenException(e.message) : new ConflictException(e.message);
        }
        throw e;
      }

      const extra = await efeitos(tx, agora, atual);
      const { count } = await tx.divergencia.updateMany({
        where: { id, status: atual.status, responsavelAtualId: atual.responsavelAtualId },
        data: { ...extra, status },
      });
      if (count === 0)
        throw new ConflictException('A divergência foi alterada por outra pessoa; recarregue a tela');

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

  private async responsavelValido(db: Tx | PrismaService, id: number) {
    const responsavel = await db.usuario.findUnique({ where: { id } });
    if (!responsavel || !responsavel.ativo) throw new BadRequestException('Responsável inválido ou inativo');
    return responsavel;
  }

  private async fecharAtribuicao(
    tx: Tx,
    divergenciaId: number,
    agora: Date,
    motivo: 'RESPONDIDA' | 'REPASSADA',
  ) {
    await tx.atribuicao.updateMany({
      where: { divergenciaId, fim: null },
      data: { fim: agora, motivoFim: motivo },
    });
  }

  private mensagem(
    tx: Tx,
    divergenciaId: number,
    autorId: number,
    tipo: TipoMensagem,
    texto: string,
    agora: Date,
  ) {
    return tx.mensagem.create({
      data: { divergenciaId, autorId, tipo, texto: texto.trim(), criadaEm: agora },
    });
  }

  private resumo<T extends { abertaEm: Date; resolvidaEm: Date | null; atribuicoes: { inicio: Date }[] }>(
    d: T,
    agora: Date,
  ) {
    const { atribuicoes, ...resto } = d;
    const aberta = atribuicoes[0];
    return {
      ...resto,
      horasAberta: arredondar(horasEntre(d.abertaEm, d.resolvidaEm, agora)),
      horasComResponsavelAtual: aberta ? arredondar(horasEntre(aberta.inicio, null, agora)) : null,
    };
  }
}

function arredondar(horas: number): number {
  return Math.round(horas * 100) / 100;
}
