import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/perfis.decorator.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarSetorDto, CriarSetorDto } from './dto/setor.dto.js';

@ApiTags('Setores')
@ApiBearerAuth()
@Controller('setores')
export class SetoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os setores' })
  listar() {
    return this.prisma.setor.findMany({ orderBy: { nome: 'asc' } });
  }

  @Post()
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Cria um setor' })
  async criar(@Body() dto: CriarSetorDto) {
    return this.salvar(() => this.prisma.setor.create({ data: { nome: dto.nome.trim() } }));
  }

  @Patch(':id')
  @Perfis('ADMIN')
  @ApiOperation({ summary: 'Atualiza ou desativa um setor' })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarSetorDto) {
    return this.salvar(() =>
      this.prisma.setor.update({ where: { id }, data: { nome: dto.nome?.trim(), ativo: dto.ativo } }),
    );
  }

  private async salvar<T>(acao: () => Promise<T>): Promise<T> {
    try {
      return await acao();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um setor com esse nome');
      }
      throw e;
    }
  }
}
