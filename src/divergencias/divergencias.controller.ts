import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MAX_ANEXO_BYTES, MAX_ANEXOS, type ArquivoRecebido } from '../anexos/arquivos.js';
import { Perfis } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { CategoriaAnexo } from '../generated/prisma/enums.js';
import { DivergenciasService } from './divergencias.service.js';
import {
  ConcluirDto,
  CriarDivergenciaDto,
  DevolverDto,
  FiltroDivergenciasDto,
  RascunhoDto,
  ReabrirDto,
  RedistribuirDto,
} from './dto/divergencias.dto.js';

const UPLOAD = FilesInterceptor('arquivos', MAX_ANEXOS, { limits: { fileSize: MAX_ANEXO_BYTES } });
const CORPO_ARQUIVOS = {
  arquivos: { type: 'array', items: { type: 'string', format: 'binary' } },
} as const;

@ApiTags('Divergências')
@ApiBearerAuth()
@Controller('divergencias')
export class DivergenciasController {
  constructor(private readonly divergencias: DivergenciasService) {}

  @Post()
  @Perfis('FISCAL', 'GESTOR', 'ADMIN')
  @ApiOperation({
    summary: 'Cadastra a divergência (nota manual ou notas importadas), gera protocolo e encaminha ao setor',
  })
  criar(@Body() dto: CriarDivergenciaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.criar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Central de divergências, fila do responsável ou fila de validação' })
  listar(@Query() filtro: FiltroDivergenciasDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.listar(filtro, usuario);
  }

  @Get('contadores')
  @ApiOperation({ summary: 'Totais da central (pendentes, devolvidas, vencidas) e da fila do usuário' })
  contadores(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.contadores(usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe com nota, histórico de movimentações, anexos e tempo por responsável' })
  detalhar(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.detalhar(id, usuario);
  }

  @Post(':id/assumir')
  @HttpCode(200)
  @ApiOperation({ summary: 'Responsável assume a tratativa (Pendente → Em tratamento)' })
  assumir(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.divergencias.assumir(id, usuario);
  }

  @Put(':id/rascunho')
  @ApiOperation({ summary: 'Salva o rascunho da devolutiva sem mudar o status' })
  rascunho(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RascunhoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.salvarRascunho(id, dto, usuario);
  }

  @Post(':id/devolver')
  @HttpCode(200)
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['texto'],
      properties: { texto: { type: 'string' }, tipoSolucao: { type: 'string' }, ...CORPO_ARQUIVOS },
    },
  })
  @ApiOperation({ summary: 'Responsável descreve a ação realizada, anexa evidências e devolve ao Fiscal' })
  devolver(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DevolverDto,
    @UploadedFiles() arquivos: ArquivoRecebido[] | undefined,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.devolver(id, dto, arquivos, usuario);
  }

  @Post(':id/concluir')
  @HttpCode(200)
  @Perfis('FISCAL', 'GESTOR', 'ADMIN')
  @ApiOperation({ summary: 'Fiscal valida a correção, registra o parecer e conclui' })
  concluir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConcluirDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.concluir(id, dto, usuario);
  }

  @Post(':id/reabrir')
  @HttpCode(200)
  @Perfis('FISCAL', 'GESTOR', 'ADMIN')
  @ApiOperation({ summary: 'Fiscal reabre com motivo; volta ao responsável mantendo o histórico e o prazo' })
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReabrirDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.reabrir(id, dto, usuario);
  }

  @Post(':id/redistribuir')
  @HttpCode(200)
  @Perfis('FISCAL', 'GESTOR', 'ADMIN')
  @ApiOperation({ summary: 'Encaminha para outro responsável ou setor' })
  redistribuir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RedistribuirDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.redistribuir(id, dto, usuario);
  }

  @Post(':id/anexos')
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['arquivos'], properties: CORPO_ARQUIVOS } })
  @ApiOperation({ summary: 'Anexa documentos (XML, PDF, JPG, PNG; até 5 de 10 MB)' })
  anexar(
    @Param('id', ParseIntPipe) id: number,
    @Query('categoria', new ParseEnumPipe(CategoriaAnexo, { optional: true }))
    categoria: CategoriaAnexo | undefined,
    @UploadedFiles() arquivos: ArquivoRecebido[] | undefined,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.divergencias.anexar(id, arquivos, categoria ?? 'APOIO', usuario);
  }

  @Get('anexos/:anexoId')
  @ApiProduces('application/octet-stream')
  @ApiOperation({ summary: 'Baixa um anexo' })
  async baixarAnexo(
    @Param('anexoId', ParseIntPipe) anexoId: number,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Res() res: Response,
  ) {
    const anexo = await this.divergencias.baixarAnexo(anexoId, usuario);
    res.setHeader('Content-Type', anexo.tipoConteudo);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeArquivo)}"`);
    res.setHeader('X-Conteudo-Sha256', anexo.sha256);
    res.send(Buffer.from(anexo.conteudo));
  }
}
