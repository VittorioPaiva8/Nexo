import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Perfis } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { FiltroNotasDto } from './dto/notas.dto.js';
import { NotasService, type ArquivoRecebido } from './notas.service.js';

const MAX_ARQUIVOS = 500;
const MAX_BYTES = 5 * 1024 * 1024;

@ApiTags('Notas fiscais')
@ApiBearerAuth()
@Controller('notas')
export class NotasController {
  constructor(private readonly notas: NotasService) {}

  @Post('importar')
  @Perfis('ADMIN', 'REVISOR')
  @UseInterceptors(FilesInterceptor('arquivos', MAX_ARQUIVOS, { limits: { fileSize: MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivos'],
      properties: { arquivos: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @ApiOperation({ summary: 'Importa XMLs de NF-e (até 500 arquivos de 5 MB por envio)' })
  importar(
    @UploadedFiles() arquivos: ArquivoRecebido[] | undefined,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    if (!arquivos || arquivos.length === 0) throw new BadRequestException('Envie ao menos um arquivo XML');
    return this.notas.importar(arquivos, usuario.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as notas importadas (paginado)' })
  listar(@Query() filtro: FiltroNotasDto) {
    return this.notas.listar(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da nota com suas divergências' })
  detalhar(@Param('id', ParseIntPipe) id: number) {
    return this.notas.detalhar(id);
  }

  @Get(':id/xml')
  @ApiProduces('application/xml')
  @ApiOperation({ summary: 'Baixa o XML original da nota' })
  async xml(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const nota = await this.notas.xml(id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nota.chaveAcesso}.xml"`);
    res.send(nota.xml);
  }
}
