import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeBrasilia, lerDia, somarDias } from '../common/datas.js';
import {
  apenasDigitos,
  chaveAcessoValida,
  cnpjValido,
  lerValor,
  normalizarNome,
  normalizarNumero,
} from '../common/documentos.js';
import type { UsuarioAutenticado } from '../common/usuario-atual.js';
import { DivergenciasService } from '../divergencias/divergencias.service.js';
import { PERFIS_GESTAO } from '../divergencias/regras.js';
import type { Prioridade } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { COLUNAS_OBRIGATORIAS, lerCsv, type ColunaCsv } from './csv.js';
import type { PadroesLoteDto } from './dto/importacoes.dto.js';

export const MAX_LINHAS = 2000;

const PRIORIDADES: Record<string, Prioridade> = {
  normal: 'NORMAL',
  alta: 'ALTA',
  critica: 'CRITICA',
};

export type SituacaoLinha = 'VALIDA' | 'DUPLICADA' | 'INVALIDA';

export interface LinhaLote {
  linha: number;
  numeroNf: string;
  serie: string;
  fornecedor: string;
  cnpj: string;
  valorTotal: string | null;
  tipo: string;
  setor: string;
  responsavel: string;
  prazo: string | null;
  situacao: SituacaoLinha;
  erros: string[];
  protocolo?: string;
}

interface LinhaPreparada extends LinhaLote {
  dados?: {
    nota: {
      numero: string;
      serie: string;
      chaveAcesso?: string;
      emitenteNome: string;
      emitenteCnpj: string;
      valorTotal: string;
      dataEmissao?: string;
      pedidoCompra?: string;
      centroCusto?: string;
      unidade?: string;
    };
    tipoId: number;
    setorId: number;
    responsavelId: number;
    prioridade: Prioridade;
    prazo: string;
    descricao: string;
  };
}

@Injectable()
export class ImportacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly divergencias: DivergenciasService,
  ) {}

  /** Confere o lote sem gravar nada: campos obrigatórios, CNPJ, chave, cadastros e duplicidades. */
  async previa(conteudo: Buffer, padroes: PadroesLoteDto, usuario: UsuarioAutenticado) {
    return this.relatorio(await this.analisar(conteudo, padroes, usuario));
  }

  /** Grava somente as linhas válidas; cada uma gera uma tratativa com protocolo próprio. */
  async confirmar(conteudo: Buffer, padroes: PadroesLoteDto, usuario: UsuarioAutenticado) {
    const linhas = await this.analisar(conteudo, padroes, usuario);
    const validas = linhas.filter((l) => l.situacao === 'VALIDA');
    if (validas.length === 0) throw new BadRequestException('Nenhuma linha válida para importar');

    const importacao = await this.prisma.$transaction(
      async (tx) => {
        const imp = await tx.importacao.create({
          data: {
            origem: 'CSV',
            usuarioId: usuario.id,
            totalArquivos: linhas.length,
            totalImportadas: validas.length,
            totalDuplicadas: linhas.filter((l) => l.situacao === 'DUPLICADA').length,
            totalInvalidas: linhas.filter((l) => l.situacao === 'INVALIDA').length,
          },
        });
        for (const l of validas) {
          const d = l.dados!;
          const notaFiscalId = await this.divergencias.localizarOuCriarNota(tx, d.nota, 'CSV', imp.id);
          const id = await this.divergencias.registrar(
            tx,
            {
              notaFiscalId,
              tipoId: d.tipoId,
              setorId: d.setorId,
              responsavelId: d.responsavelId,
              prioridade: d.prioridade,
              prazo: d.prazo,
              descricao: d.descricao,
            },
            usuario.id,
          );
          l.protocolo = (await tx.divergencia.findUniqueOrThrow({ where: { id } })).protocolo;
        }
        return imp;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    return { importacao, ...this.relatorio(linhas) };
  }

  private relatorio(linhas: LinhaPreparada[]) {
    const conta = (s: SituacaoLinha) => linhas.filter((l) => l.situacao === s).length;
    return {
      totalLinhas: linhas.length,
      validas: conta('VALIDA'),
      duplicadas: conta('DUPLICADA'),
      invalidas: conta('INVALIDA'),
      linhas: linhas.map(({ dados: _dados, ...l }) => l),
    };
  }

  private async analisar(
    conteudo: Buffer,
    padroes: PadroesLoteDto,
    usuario: UsuarioAutenticado,
  ): Promise<LinhaPreparada[]> {
    const tabela = lerCsv(conteudo.toString('utf8'));
    if (tabela.length < 2) throw new BadRequestException('O arquivo não tem linhas de dados');
    if (tabela.length - 1 > MAX_LINHAS) {
      throw new BadRequestException(`O lote pode ter no máximo ${MAX_LINHAS} linhas`);
    }
    const cabecalho = tabela[0]!.map((c) => normalizarNome(c).replace(/\s/g, '_'));
    const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !cabecalho.includes(c));
    if (faltando.length) {
      throw new BadRequestException(
        `Coluna(s) ausente(s) no cabeçalho: ${faltando.join(', ')}. Baixe o modelo de importação.`,
      );
    }

    const [tipos, setores, usuarios] = await Promise.all([
      this.prisma.tipoDivergencia.findMany({ where: { ativo: true } }),
      this.prisma.setor.findMany({ where: { ativo: true } }),
      this.prisma.usuario.findMany({ where: { ativo: true } }),
    ]);
    const tipoPorNome = new Map(tipos.map((t) => [normalizarNome(t.nome), t]));
    const setorPorNome = new Map(setores.map((s) => [normalizarNome(s.nome), s]));
    const usuarioPorNome = new Map<string, (typeof usuarios)[number]>();
    for (const u of usuarios) {
      usuarioPorNome.set(normalizarNome(u.nome), u);
      usuarioPorNome.set(u.email.toLowerCase(), u);
    }
    const setorPadrao = padroes.setorId ? setores.find((s) => s.id === padroes.setorId) : undefined;
    const responsavelPadrao = padroes.responsavelId
      ? usuarios.find((u) => u.id === padroes.responsavelId)
      : undefined;
    const hoje = hojeBrasilia();

    const vistas = new Map<string, number>();
    const linhas: LinhaPreparada[] = tabela.slice(1).map((valores, i) => {
      const v = (c: ColunaCsv) => valores[cabecalho.indexOf(c)]?.trim() ?? '';
      const erros: string[] = [];

      const numero = normalizarNumero(v('numero_nf'));
      if (!numero || numero.length > 9) erros.push('Número da NF ausente ou inválido');
      const serie = normalizarNumero(v('serie'));
      if (!serie || serie.length > 3) erros.push('Série ausente ou inválida');
      const cnpj = apenasDigitos(v('cnpj_emissor'));
      if (!cnpjValido(cnpj)) erros.push('CNPJ do emissor inválido');
      const fornecedor = v('fornecedor');
      if (fornecedor.length < 2) erros.push('Fornecedor ausente');
      const valorTotal = lerValor(v('valor_total'));
      if (!valorTotal) erros.push('Valor total inválido');
      const chave = apenasDigitos(v('chave_acesso'));
      if (chave && !chaveAcessoValida(chave)) erros.push('Chave de acesso inválida');
      const dataEmissao = v('data_emissao') ? lerDia(v('data_emissao')) : null;
      if (v('data_emissao') && !dataEmissao) erros.push('Data de emissão inválida');
      const descricao = v('descricao');
      if (descricao.length < 10) erros.push('Descrição muito curta (mínimo 10 caracteres)');

      const tipo = tipoPorNome.get(normalizarNome(v('tipo_divergencia')));
      if (!tipo) erros.push(`Tipo de divergência "${v('tipo_divergencia')}" não cadastrado`);
      const setor = v('setor') ? setorPorNome.get(normalizarNome(v('setor'))) : setorPadrao;
      if (!setor) erros.push(v('setor') ? `Setor "${v('setor')}" não cadastrado` : 'Setor não informado');
      const chaveResp = v('responsavel');
      const responsavel = chaveResp
        ? (usuarioPorNome.get(normalizarNome(chaveResp)) ?? usuarioPorNome.get(chaveResp.toLowerCase()))
        : responsavelPadrao;
      if (!responsavel) {
        erros.push(chaveResp ? `Responsável "${chaveResp}" não encontrado` : 'Responsável não informado');
      } else if (setor && responsavel.setorId !== setor.id && !PERFIS_GESTAO.includes(usuario.perfil)) {
        erros.push(`${responsavel.nome} não pertence ao setor ${setor.nome}`);
      }

      const prioridadeTexto = normalizarNome(v('prioridade'));
      const prioridade = prioridadeTexto ? PRIORIDADES[prioridadeTexto] : (padroes.prioridade ?? 'NORMAL');
      if (!prioridade) erros.push('Prioridade deve ser Normal, Alta ou Crítica');
      let prazo = v('prazo') ? lerDia(v('prazo')) : (padroes.prazo ?? null);
      if (v('prazo') && !prazo) erros.push('Prazo inválido');
      if (prazo && prazo < hoje) erros.push('Prazo anterior a hoje');
      if (!prazo && setor) prazo = somarDias(hoje, setor.slaDias);

      const linha: LinhaPreparada = {
        linha: i + 2,
        numeroNf: v('numero_nf'),
        serie: v('serie'),
        fornecedor,
        cnpj: v('cnpj_emissor'),
        valorTotal,
        tipo: tipo?.nome ?? v('tipo_divergencia'),
        setor: setor?.nome ?? v('setor'),
        responsavel: responsavel?.nome ?? chaveResp,
        prazo,
        situacao: erros.length ? 'INVALIDA' : 'VALIDA',
        erros,
      };
      if (erros.length) return linha;

      const chaveLote = `${cnpj}|${serie}|${numero}|${tipo!.id}`;
      const repetida = vistas.get(chaveLote);
      if (repetida) {
        return { ...linha, situacao: 'DUPLICADA', erros: [`Repete a linha ${repetida} do arquivo`] };
      }
      vistas.set(chaveLote, linha.linha);
      return {
        ...linha,
        dados: {
          nota: {
            numero,
            serie,
            chaveAcesso: chave || undefined,
            emitenteNome: fornecedor,
            emitenteCnpj: cnpj,
            valorTotal: valorTotal!,
            dataEmissao: dataEmissao ?? undefined,
            pedidoCompra: v('pedido_compra') || undefined,
            centroCusto: v('centro_custo') || undefined,
            unidade: v('unidade') || undefined,
          },
          tipoId: tipo!.id,
          setorId: setor!.id,
          responsavelId: responsavel!.id,
          prioridade: prioridade!,
          prazo: prazo!,
          descricao,
        },
      };
    });

    await this.marcarJaCadastradas(linhas);
    return linhas;
  }

  /** Reimportar o mesmo arquivo não cria ocorrência repetida (mesma NF + tipo ainda aberta). */
  private async marcarJaCadastradas(linhas: LinhaPreparada[]) {
    const candidatas = linhas.filter((l) => l.situacao === 'VALIDA');
    if (candidatas.length === 0) return;
    const abertas = await this.prisma.divergencia.findMany({
      where: {
        status: { not: 'CONCLUIDA' },
        notaFiscal: {
          OR: candidatas.map((l) => ({
            emitenteCnpj: l.dados!.nota.emitenteCnpj,
            serie: l.dados!.nota.serie,
            numero: l.dados!.nota.numero,
          })),
        },
      },
      select: {
        protocolo: true,
        tipoId: true,
        notaFiscal: { select: { emitenteCnpj: true, serie: true, numero: true } },
      },
    });
    for (const l of candidatas) {
      const n = l.dados!.nota;
      const existente = abertas.find(
        (a) =>
          a.tipoId === l.dados!.tipoId &&
          a.notaFiscal.emitenteCnpj === n.emitenteCnpj &&
          a.notaFiscal.serie === n.serie &&
          a.notaFiscal.numero === n.numero,
      );
      if (existente) {
        l.situacao = 'DUPLICADA';
        l.erros = [`Já existe a divergência ${existente.protocolo} aberta para esta NF e tipo`];
        delete l.dados;
      }
    }
  }
}
