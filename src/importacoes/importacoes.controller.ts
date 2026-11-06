import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  type ApiBodyOptions,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ArquivoRecebido } from '../anexos/arquivos.js';
import { Perfis } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { PadroesLoteDto } from './dto/importacoes.dto.js';
import { ImportacoesService } from './importacoes.service.js';

const UPLOAD = FileInterceptor('arquivo', { limits: { fileSize: 2 * 1024 * 1024 } });
const CORPO: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['arquivo'],
    properties: {
      arquivo: { type: 'string', format: 'binary' },
      setorId: { type: 'integer' },
      responsavelId: { type: 'integer' },
      prazo: { type: 'string', format: 'date' },
      prioridade: { type: 'string', enum: ['NORMAL', 'ALTA', 'CRITICA'] },
    },
  },
};

function exigirCsv(arquivo: ArquivoRecebido | undefined): Buffer {
  if (!arquivo) throw new BadRequestException('Envie o arquivo CSV');
  if (!/\.(csv|txt)$/i.test(arquivo.originalname)) {
    throw new BadRequestException('Envie um arquivo .csv separado por ponto e vírgula');
  }
  return arquivo.buffer;
}

@ApiTags('Importação em lote')
@ApiBearerAuth()
@Perfis('FISCAL', 'GESTOR', 'ADMIN')
@Controller('importacoes/csv')
export class ImportacoesController {
  constructor(private readonly importacoes: ImportacoesService) {}

  @Post('previa')
  @HttpCode(200)
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody(CORPO)
  @ApiOperation({ summary: 'Confere o CSV (obrigatórios, CNPJ, chave, cadastros e duplicidades) sem gravar' })
  previa(
    @UploadedFile() arquivo: ArquivoRecebido | undefined,
    @Body() padroes: PadroesLoteDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.importacoes.previa(exigirCsv(arquivo), padroes, usuario);
  }

  @Post()
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody(CORPO)
  @ApiOperation({ summary: 'Importa as linhas válidas do CSV e distribui as tratativas' })
  confirmar(
    @UploadedFile() arquivo: ArquivoRecebido | undefined,
    @Body() padroes: PadroesLoteDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.importacoes.confirmar(exigirCsv(arquivo), padroes, usuario);
  }
}
