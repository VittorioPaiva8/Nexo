import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ConfigurarAvisoDto {
  @ApiProperty()
  @IsBoolean()
  ativo: boolean;
}
