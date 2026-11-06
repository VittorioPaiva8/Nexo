import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginado } from '../common/envelope.interceptor.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FiltroNotasDto } from './dto/notas.dto.js';
import { ErroLeituraNfe, lerXmlNfe, type DadosNfe } from './nfe-parser.js';

export interface ArquivoRecebido {
  originalname: string;
  buffer: Buffer;
}

const CAMPOS_LISTA = {
  id: true,
  chaveAcesso: true,
  numero: true,
  serie: true,
  modelo: true,
  dataEmissao: true,
  emitenteCnpj: true,
  emitenteNome: true,
  destinatarioDoc: true,
  destinatarioNome: true,
  valorTotal: true,
  naturezaOperacao: true,
  status: true,
  importacaoId: true,
  criadaEm: true,
} satisfies Prisma.NotaFiscalSelect;

@Injectable()
export class NotasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lê os XMLs, ignora chaves já existentes e grava as novas notas numa importação. */
  async importar(arquivos: ArquivoRecebido[], usuarioId: number) {
    const erros: { arquivo: string; motivo: string }[] = [];
    const lidas = new Map<string, { dados: DadosNfe; xml: string; arquivo: string }>();
    const duplicadas: { arquivo: string; chaveAcesso: string }[] = [];

    for (const arquivo of arquivos) {
      const xml = arquivo.buffer.toString('utf8');
      try {
        const dados = lerXmlNfe(xml);
        if (lidas.has(dados.chaveAcesso)) {
          duplicadas.push({ arquivo: arquivo.originalname, chaveAcesso: dados.chaveAcesso });
        } else {
          lidas.set(dados.chaveAcesso, { dados, xml, arquivo: arquivo.originalname });
        }
      } catch (e) {
        if (!(e instanceof ErroLeituraNfe)) throw e;
        erros.push({ arquivo: arquivo.originalname, motivo: e.message });
      }
    }

    const existentes = await this.prisma.notaFiscal.findMany({
      where: { chaveAcesso: { in: [...lidas.keys()] } },
      select: { chaveAcesso: true },
    });
    for (const { chaveAcesso } of existentes) {
      duplicadas.push({ arquivo: lidas.get(chaveAcesso)!.arquivo, chaveAcesso });
      lidas.delete(chaveAcesso);
    }

    const importacao = await this.prisma.$transaction(async (tx) => {
      const imp = await tx.importacao.create({
        data: {
          usuarioId,
          totalArquivos: arquivos.length,
          totalImportadas: lidas.size,
          totalDuplicadas: duplicadas.length,
          totalInvalidas: erros.length,
        },
      });
      await tx.notaFiscal.createMany({
        data: [...lidas.values()].map(({ dados, xml }) => ({ ...dados, xml, importacaoId: imp.id })),
        skipDuplicates: true,
      });
      return imp;
    });

    const notas = await this.prisma.notaFiscal.findMany({
      where: { importacaoId: importacao.id },
      select: CAMPOS_LISTA,
      orderBy: { dataEmissao: 'asc' },
    });
    return { importacao, notas, duplicadas, erros };
  }

  async listar(filtro: FiltroNotasDto) {
    const busca = filtro.busca?.trim();
    const where: Prisma.NotaFiscalWhereInput = {
      status: filtro.status,
      importacaoId: filtro.importacaoId,
      ...(busca
        ? {
            OR: [
              { numero: { contains: busca } },
              { chaveAcesso: { contains: busca.replace(/\D/g, '') || busca } },
              { emitenteCnpj: { contains: busca.replace(/\D/g, '') || busca } },
              { emitenteNome: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, itens] = await this.prisma.$transaction([
      this.prisma.notaFiscal.count({ where }),
      this.prisma.notaFiscal.findMany({
        where,
        select: {
          ...CAMPOS_LISTA,
          _count: { select: { divergencias: { where: { status: { not: 'RESOLVIDA' } } } } },
        },
        orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
    ]);
    return new Paginado(
      itens.map(({ _count, ...nota }) => ({ ...nota, divergenciasAbertas: _count.divergencias })),
      { pagina: filtro.pagina, porPagina: filtro.porPagina, total },
    );
  }

  async detalhar(id: number) {
    const nota = await this.prisma.notaFiscal.findUnique({
      where: { id },
      select: {
        ...CAMPOS_LISTA,
        divergencias: {
          orderBy: { abertaEm: 'desc' },
          include: {
            tipo: true,
            solicitante: { select: { id: true, nome: true } },
            responsavelAtual: { select: { id: true, nome: true, setor: true } },
          },
        },
      },
    });
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    return nota;
  }

  async xml(id: number) {
    const nota = await this.prisma.notaFiscal.findUnique({
      where: { id },
      select: { xml: true, chaveAcesso: true },
    });
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    return nota;
  }
}
