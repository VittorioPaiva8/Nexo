import { Container, getContainer } from '@cloudflare/containers';

/**
 * Ponto de entrada no Cloudflare:
 * - /api/* vai para o container com a API NestJS (o prefixo /api é removido);
 * - o resto é servido pelos arquivos estáticos do frontend (web/dist), como SPA.
 */
interface Env {
  NEXO_API: DurableObjectNamespace<NexoApi>;
  ASSETS: Fetcher;
  DATABASE_URL: string;
  JWT_SECRET: string;
}

export class NexoApi extends Container<Env> {
  defaultPort = 3000;
  // Desliga o container depois de 15 minutos sem uso; o próximo acesso liga de novo (alguns segundos).
  sleepAfter = '15m';

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    super(ctx, env);
    this.envVars = {
      PORT: '3000',
      NODE_ENV: 'production',
      JWT_EXPIRES_IN: '8h',
      DATABASE_URL: env.DATABASE_URL,
      JWT_SECRET: env.JWT_SECRET,
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.slice('/api'.length) || '/';
      return getContainer(env.NEXO_API).fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
