import { ValidateBy, type ValidationOptions } from 'class-validator';
import { chaveAcessoValida, cnpjValido } from './documentos.js';
import { lerDia } from './datas.js';

export function IsCnpj(opcoes?: ValidationOptions) {
  return ValidateBy(
    { name: 'isCnpj', validator: { validate: (v) => typeof v === 'string' && cnpjValido(v) } },
    { message: 'CNPJ do emissor inválido (confira os dígitos)', ...opcoes },
  );
}

export function IsChaveAcesso(opcoes?: ValidationOptions) {
  return ValidateBy(
    { name: 'isChaveAcesso', validator: { validate: (v) => typeof v === 'string' && chaveAcessoValida(v) } },
    { message: 'Chave de acesso inválida (44 dígitos com dígito verificador)', ...opcoes },
  );
}

/** Data no formato AAAA-MM-DD. */
export function IsDia(opcoes?: ValidationOptions) {
  return ValidateBy(
    { name: 'isDia', validator: { validate: (v) => typeof v === 'string' && lerDia(v) === v } },
    { message: 'Data inválida (use AAAA-MM-DD)', ...opcoes },
  );
}
