import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AtualizarUsuarioDto, CriarUsuarioDto, FiltroUsuariosDto } from './dto/usuario.dto.js';
import { usuarioPublico } from './usuario-publico.js';

const RODADAS_BCRYPT = 10;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroUsuariosDto) {
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        perfil: filtro.perfil,
        setorId: filtro.setorId,
        ativo: filtro.incluirInativos ? undefined : true,
      },
      include: { setor: true },
      orderBy: { nome: 'asc' },
    });
    return usuarios.map(usuarioPublico);
  }

  async criar(dto: CriarUsuarioDto) {
    if (dto.perfil === 'RESPONSAVEL' && !dto.setorId) {
      throw new BadRequestException('Responsáveis precisam estar vinculados a um setor');
    }
    const senhaHash = await bcrypt.hash(dto.senha, RODADAS_BCRYPT);
    return this.salvar(() =>
      this.prisma.usuario.create({
        data: {
          nome: dto.nome.trim(),
          email: dto.email.toLowerCase().trim(),
          senhaHash,
          perfil: dto.perfil,
          setorId: dto.setorId,
        },
        include: { setor: true },
      }),
    );
  }

  async atualizar(id: number, dto: AtualizarUsuarioDto) {
    const senhaHash = dto.senha ? await bcrypt.hash(dto.senha, RODADAS_BCRYPT) : undefined;
    return this.salvar(() =>
      this.prisma.usuario.update({
        where: { id },
        data: {
          nome: dto.nome?.trim(),
          email: dto.email?.toLowerCase().trim(),
          perfil: dto.perfil,
          setorId: dto.setorId,
          ativo: dto.ativo,
          senhaHash,
        },
        include: { setor: true },
      }),
    );
  }

  private async salvar(acao: () => Promise<Parameters<typeof usuarioPublico>[0]>) {
    try {
      return usuarioPublico(await acao());
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com esse e-mail');
      }
      throw e;
    }
  }
}
