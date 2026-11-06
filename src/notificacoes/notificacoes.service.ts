import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { EventoNotificacao } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = Prisma.TransactionClient | PrismaService;

/** Situação padrão de cada aviso enquanto o administrador não altera (manual, seção 9). */
export const AVISOS: Record<EventoNotificacao, { titulo: string; descricao: string; padrao: boolean }> = {
  NOVA_ATRIBUICAO: {
    titulo: 'Novas solicitações ao responsável',
    descricao: 'E-mail ao usuário quando designado',
    padrao: true,
  },
  DEVOLUCAO: {
    titulo: 'Devolução para o Fiscal',
    descricao: 'Alerta ao criador para validar a correção',
    padrao: true,
  },
  PRAZO_PROXIMO: {
    titulo: 'Prazo próximo do vencimento',
    descricao: 'Avisar 24 horas antes do limite',
    padrao: false,
  },
  ESCALONAMENTO: {
    titulo: 'Escalonamento ao gestor',
    descricao: 'Notificar ocorrências vencidas ou reabertas',
    padrao: true,
  },
};

const SEM_CANAL = 'Envio de e-mail não configurado (SMTP ou API corporativa); aviso registrado no sistema.';

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o aviso para cada destinatário. Sem serviço de e-mail configurado, fica como
   * NAO_ENVIADA (o manual pede não considerar envio sem confirmação) e aparece no sino do sistema.
   */
  async registrar(
    db: Db,
    evento: EventoNotificacao,
    destinatarios: number[],
    divergencia: { id: number; protocolo: string },
    assunto: string,
  ) {
    const unicos = [...new Set(destinatarios)];
    if (unicos.length === 0) return;
    const config = await db.configNotificacao.findUnique({ where: { evento } });
    if (!(config?.ativo ?? AVISOS[evento].padrao)) return;
    await db.notificacao.createMany({
      data: unicos.map((destinatarioId) => ({
        evento,
        destinatarioId,
        divergenciaId: divergencia.id,
        assunto: `${divergencia.protocolo} · ${assunto}`,
        situacao: 'NAO_ENVIADA' as const,
        detalhe: SEM_CANAL,
      })),
    });
  }

  async minhas(usuarioId: number) {
    const [itens, naoLidas] = await this.prisma.$transaction([
      this.prisma.notificacao.findMany({
        where: { destinatarioId: usuarioId },
        orderBy: { id: 'desc' },
        take: 20,
        select: {
          id: true,
          evento: true,
          assunto: true,
          situacao: true,
          criadaEm: true,
          lidaEm: true,
          divergenciaId: true,
        },
      }),
      this.prisma.notificacao.count({ where: { destinatarioId: usuarioId, lidaEm: null } }),
    ]);
    return { itens, naoLidas };
  }

  async marcarLidas(usuarioId: number) {
    const { count } = await this.prisma.notificacao.updateMany({
      where: { destinatarioId: usuarioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return { marcadas: count };
  }

  async configuracoes() {
    const salvas = await this.prisma.configNotificacao.findMany();
    return (Object.keys(AVISOS) as EventoNotificacao[]).map((evento) => ({
      evento,
      ...AVISOS[evento],
      ativo: salvas.find((s) => s.evento === evento)?.ativo ?? AVISOS[evento].padrao,
    }));
  }

  async configurar(evento: EventoNotificacao, ativo: boolean) {
    await this.prisma.configNotificacao.upsert({
      where: { evento },
      create: { evento, ativo },
      update: { ativo },
    });
    return this.configuracoes();
  }
}
