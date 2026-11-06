import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/perfis.decorator.js';
import { UsuarioAtual, type UsuarioAutenticado } from '../common/usuario-atual.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entra no sistema e devolve o token JWT' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado' })
  me(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.auth.me(usuario.id);
  }
}
