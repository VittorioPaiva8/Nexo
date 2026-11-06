import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { usuarioPublico } from '../usuarios/usuario-publico.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
      include: { setor: true },
    });
    if (!usuario || !usuario.ativo || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const token = await this.jwt.signAsync({ sub: usuario.id, perfil: usuario.perfil });
    return { token, usuario: usuarioPublico(usuario) };
  }

  async me(id: number) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id }, include: { setor: true } });
    return usuarioPublico(usuario);
  }
}
