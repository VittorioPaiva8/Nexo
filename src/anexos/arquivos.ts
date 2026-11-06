import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface ArquivoRecebido {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

export const MAX_ANEXO_BYTES = 10 * 1024 * 1024;
export const MAX_ANEXOS = 5;

const TIPOS: Record<string, string> = {
  xml: 'application/xml',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Anexos permitidos: XML, DANFE/PDF e imagens (manual, seção 11). */
export function prepararAnexos(arquivos: ArquivoRecebido[] | undefined) {
  return (arquivos ?? []).map((a) => {
    const extensao = a.originalname.split('.').pop()?.toLowerCase() ?? '';
    const tipoConteudo = TIPOS[extensao];
    if (!tipoConteudo) {
      throw new BadRequestException(`Arquivo "${a.originalname}" não permitido (use XML, PDF, JPG ou PNG)`);
    }
    if (a.buffer.length > MAX_ANEXO_BYTES) {
      throw new BadRequestException(`Arquivo "${a.originalname}" passa de 10 MB`);
    }
    return {
      nomeArquivo: a.originalname.slice(0, 200),
      tipoConteudo,
      tamanho: a.buffer.length,
      sha256: createHash('sha256').update(a.buffer).digest('hex'),
      conteudo: new Uint8Array(a.buffer),
    };
  });
}
