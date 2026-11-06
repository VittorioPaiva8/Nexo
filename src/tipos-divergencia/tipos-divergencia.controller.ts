import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarTipoDivergenciaDto, CriarTipoDivergenciaDto } from './dto/tipo-divergencia.dto.js';

@ApiTags('Tipos de divergência')
@ApiBearerAuth()
@Controller('tipos-divergencia')
export class TiposDivergenciaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os tipos de divergência' })
  listar() {
    return this.prisma.tipoDivergencia.findMany({
      orderBy: { nome: 'asc' },
      include: { setorOrigem: { select: { id: true, nome: true } } },
    });
  }

  @Post()
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Cria um tipo de divergência' })
  async criar(@Body() dto: CriarTipoDivergenciaDto) {
    return this.salvar(() =>
      this.prisma.tipoDivergencia.create({
        data: { nome: dto.nome.trim(), setorOrigemId: dto.setorOrigemId },
      }),
    );
  }

  @Patch(':id')
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Atualiza ou desativa um tipo de divergência' })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarTipoDivergenciaDto) {
    return this.salvar(() =>
      this.prisma.tipoDivergencia.update({
        where: { id },
        data: { nome: dto.nome?.trim(), setorOrigemId: dto.setorOrigemId, ativo: dto.ativo },
      }),
    );
  }

  private async salvar<T>(acao: () => Promise<T>): Promise<T> {
    try {
      return await acao();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um tipo de divergência com esse nome');
      }
      throw e;
    }
  }
}
