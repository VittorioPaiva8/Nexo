import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'revisor@itax.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString({ message: 'Informe a senha' })
  @MinLength(6, { message: 'A senha tem no mínimo 6 caracteres' })
  senha: string;
}
