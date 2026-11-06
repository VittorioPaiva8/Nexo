import { api, type EnvApi } from './api.js';

/**
 * Ponto de entrada no Cloudflare Workers (plano gratuito):
 * - /api/* é atendido pela API do Nexo (cloudflare/api.ts);
 * - o resto são os arquivos do frontend (web/dist), servidos como SPA pelo próprio Cloudflare.
 */
interface Env extends EnvApi {
  ASSETS: Fetcher;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
