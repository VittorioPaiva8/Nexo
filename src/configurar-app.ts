import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** Configuração comum à aplicação real e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

export function documentoOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Nexo — NF-es divergentes')
    .setDescription(
      'API do Nexo: importação de NF-es, marcação de divergências, encaminhamento a responsáveis, ' +
        'retorno com justificativa/correção e métricas de tempo por setor e responsável. ' +
        'Respostas no envelope { data }, { data, meta } (listas) ou { error }.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
