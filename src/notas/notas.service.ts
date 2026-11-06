import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginado } from '../common/paginado.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ArquivoRecebido } from '../anexos/arquivos.js';
import { apenasDigitos, normalizarNumero } from '../common/documentos.js';
import type { FiltroNotasDto } from './dto/notas.dto.js';
import { ErroLeituraNfe, lerXmlNfe, type DadosNfe } from './nfe-parser.js';

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
  pedidoCompra: true,
  unidade: true,
  centroCusto: true,
  origem: true,
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

    // Já existente pela chave ou por CNPJ + série + número (nota cadastrada manualmente ou por CSV).
    const existentes = await this.prisma.notaFiscal.findMany({
      where: {
        OR: [
          { chaveAcesso: { in: [...lidas.keys()] } },
          ...[...lidas.values()].map(({ dados }) => ({
            emitenteCnpj: dados.emitenteCnpj,
            serie: dados.serie,
            numero: dados.numero,
          })),
        ],
      },
      select: { chaveAcesso: true, emitenteCnpj: true, serie: true, numero: true },
    });
    for (const [chave, { dados, arquivo }] of lidas) {
      const repetida = existentes.some(
        (e) =>
          e.chaveAcesso === chave ||
          (e.emitenteCnpj === dados.emitenteCnpj && e.serie === dados.serie && e.numero === dados.numero),
      );
      if (repetida) {
        duplicadas.push({ arquivo, chaveAcesso: chave });
        lidas.delete(chave);
      }
    }

    const importacao = await this.prisma.$transaction(async (tx) => {
      const imp = await tx.importacao.create({
        data: {
          origem: 'XML',
          usuarioId,
          totalArquivos: arquivos.length,
          totalImportadas: lidas.size,
          totalDuplicadas: duplicadas.length,
          totalInvalidas: erros.length,
        },
      });
      await tx.notaFiscal.createMany({
        data: [...lidas.values()].map(({ dados, xml }) => ({
          ...dados,
          xml,
          origem: 'XML' as const,
          importacaoId: imp.id,
        })),
        skipDuplicates: true,
      });
      return imp;
    });

    const notas = await this.prisma.notaFiscal.findMany({
      where: { importacaoId: importacao.id },
      select: CAMPOS_LISTA,
      orderBy: { id: 'asc' },
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
              ...(apenasDigitos(busca)
                ? [
                    { numero: { contains: normalizarNumero(busca) } },
                    { chaveAcesso: { contains: apenasDigitos(busca) } },
                    { emitenteCnpj: { contains: apenasDigitos(busca) } },
                  ]
                : []),
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
          _count: { select: { divergencias: { where: { status: { not: 'CONCLUIDA' } } } } },
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
          select: {
            id: true,
            protocolo: true,
            status: true,
            prazo: true,
            tipo: { select: { id: true, nome: true } },
            setor: { select: { id: true, nome: true } },
            responsavelAtual: { select: { id: true, nome: true } },
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
    if (!nota || !nota.xml) throw new NotFoundException('Esta nota não tem XML anexado');
    return { xml: nota.xml, chaveAcesso: nota.chaveAcesso ?? `nota-${id}` };
  }
}
