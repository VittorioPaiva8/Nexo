-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "nexo";

-- CreateEnum
CREATE TYPE "nexo"."Perfil" AS ENUM ('FISCAL', 'TRATADOR', 'GESTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "nexo"."OrigemNota" AS ENUM ('XML', 'MANUAL', 'CSV');

-- CreateEnum
CREATE TYPE "nexo"."StatusNota" AS ENUM ('SEM_PENDENCIA', 'EM_AJUSTE', 'AJUSTADA');

-- CreateEnum
CREATE TYPE "nexo"."StatusDivergencia" AS ENUM ('PENDENTE', 'EM_TRATAMENTO', 'DEVOLVIDA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "nexo"."Prioridade" AS ENUM ('NORMAL', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "nexo"."AcaoMovimentacao" AS ENUM ('CADASTRO', 'ASSUNCAO', 'DEVOLUCAO', 'CONCLUSAO', 'REABERTURA', 'REDISTRIBUICAO');

-- CreateEnum
CREATE TYPE "nexo"."MotivoFimAtribuicao" AS ENUM ('DEVOLVIDA', 'REDISTRIBUIDA');

-- CreateEnum
CREATE TYPE "nexo"."CategoriaAnexo" AS ENUM ('APOIO', 'EVIDENCIA');

-- CreateEnum
CREATE TYPE "nexo"."EventoNotificacao" AS ENUM ('NOVA_ATRIBUICAO', 'DEVOLUCAO', 'PRAZO_PROXIMO', 'ESCALONAMENTO');

-- CreateEnum
CREATE TYPE "nexo"."SituacaoNotificacao" AS ENUM ('NAO_ENVIADA', 'ENVIADA', 'FALHA');

-- CreateTable
CREATE TABLE "nexo"."Setor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "slaDias" INTEGER NOT NULL DEFAULT 2,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "nexo"."Perfil" NOT NULL DEFAULT 'TRATADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "setorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Importacao" (
    "id" SERIAL NOT NULL,
    "origem" "nexo"."OrigemNota" NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalArquivos" INTEGER NOT NULL,
    "totalImportadas" INTEGER NOT NULL,
    "totalDuplicadas" INTEGER NOT NULL,
    "totalInvalidas" INTEGER NOT NULL,

    CONSTRAINT "Importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."NotaFiscal" (
    "id" SERIAL NOT NULL,
    "chaveAcesso" CHAR(44),
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "modelo" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "emitenteCnpj" TEXT NOT NULL,
    "emitenteNome" TEXT NOT NULL,
    "destinatarioDoc" TEXT,
    "destinatarioNome" TEXT,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "naturezaOperacao" TEXT,
    "pedidoCompra" TEXT,
    "unidade" TEXT,
    "centroCusto" TEXT,
    "xml" TEXT,
    "origem" "nexo"."OrigemNota" NOT NULL,
    "status" "nexo"."StatusNota" NOT NULL DEFAULT 'SEM_PENDENCIA',
    "importacaoId" INTEGER,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."TipoDivergencia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "setorOrigemId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoDivergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Divergencia" (
    "id" SERIAL NOT NULL,
    "protocolo" TEXT NOT NULL,
    "notaFiscalId" INTEGER NOT NULL,
    "tipoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorNf" TEXT,
    "valorEsperado" TEXT,
    "correcaoEsperada" TEXT,
    "prioridade" "nexo"."Prioridade" NOT NULL DEFAULT 'NORMAL',
    "prazo" DATE NOT NULL,
    "status" "nexo"."StatusDivergencia" NOT NULL DEFAULT 'PENDENTE',
    "setorId" INTEGER NOT NULL,
    "solicitanteId" INTEGER NOT NULL,
    "responsavelAtualId" INTEGER,
    "devolutiva" TEXT,
    "tipoSolucao" TEXT,
    "rascunho" TEXT,
    "parecer" TEXT,
    "reaberturas" INTEGER NOT NULL DEFAULT 0,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "devolvidaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "Divergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."SequenciaProtocolo" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "SequenciaProtocolo_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "nexo"."Atribuicao" (
    "id" SERIAL NOT NULL,
    "divergenciaId" INTEGER NOT NULL,
    "responsavelId" INTEGER NOT NULL,
    "setorId" INTEGER,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "motivoFim" "nexo"."MotivoFimAtribuicao",

    CONSTRAINT "Atribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Movimentacao" (
    "id" SERIAL NOT NULL,
    "divergenciaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "acao" "nexo"."AcaoMovimentacao" NOT NULL,
    "statusAnterior" "nexo"."StatusDivergencia",
    "statusNovo" "nexo"."StatusDivergencia" NOT NULL,
    "texto" TEXT NOT NULL,
    "destinoId" INTEGER,
    "setorDestino" TEXT,
    "prazoAnterior" DATE,
    "prazoNovo" DATE,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Anexo" (
    "id" SERIAL NOT NULL,
    "divergenciaId" INTEGER NOT NULL,
    "movimentacaoId" INTEGER,
    "usuarioId" INTEGER NOT NULL,
    "categoria" "nexo"."CategoriaAnexo" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."Notificacao" (
    "id" SERIAL NOT NULL,
    "evento" "nexo"."EventoNotificacao" NOT NULL,
    "divergenciaId" INTEGER,
    "destinatarioId" INTEGER NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'EMAIL',
    "assunto" TEXT NOT NULL,
    "situacao" "nexo"."SituacaoNotificacao" NOT NULL,
    "detalhe" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexo"."ConfigNotificacao" (
    "evento" "nexo"."EventoNotificacao" NOT NULL,
    "ativo" BOOLEAN NOT NULL,

    CONSTRAINT "ConfigNotificacao_pkey" PRIMARY KEY ("evento")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "nexo"."Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "nexo"."Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chaveAcesso_key" ON "nexo"."NotaFiscal"("chaveAcesso");

-- CreateIndex
CREATE INDEX "NotaFiscal_status_idx" ON "nexo"."NotaFiscal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_emitenteCnpj_serie_numero_key" ON "nexo"."NotaFiscal"("emitenteCnpj", "serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDivergencia_nome_key" ON "nexo"."TipoDivergencia"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Divergencia_protocolo_key" ON "nexo"."Divergencia"("protocolo");

-- CreateIndex
CREATE INDEX "Divergencia_status_idx" ON "nexo"."Divergencia"("status");

-- CreateIndex
CREATE INDEX "Divergencia_responsavelAtualId_status_idx" ON "nexo"."Divergencia"("responsavelAtualId", "status");

-- CreateIndex
CREATE INDEX "Divergencia_setorId_status_idx" ON "nexo"."Divergencia"("setorId", "status");

-- CreateIndex
CREATE INDEX "Divergencia_notaFiscalId_tipoId_idx" ON "nexo"."Divergencia"("notaFiscalId", "tipoId");

-- CreateIndex
CREATE INDEX "Atribuicao_divergenciaId_idx" ON "nexo"."Atribuicao"("divergenciaId");

-- CreateIndex
CREATE INDEX "Atribuicao_setorId_idx" ON "nexo"."Atribuicao"("setorId");

-- CreateIndex
CREATE INDEX "Atribuicao_responsavelId_idx" ON "nexo"."Atribuicao"("responsavelId");

-- CreateIndex
CREATE INDEX "Movimentacao_divergenciaId_idx" ON "nexo"."Movimentacao"("divergenciaId");

-- CreateIndex
CREATE INDEX "Anexo_divergenciaId_idx" ON "nexo"."Anexo"("divergenciaId");

-- CreateIndex
CREATE INDEX "Notificacao_destinatarioId_lidaEm_idx" ON "nexo"."Notificacao"("destinatarioId", "lidaEm");

-- AddForeignKey
ALTER TABLE "nexo"."Usuario" ADD CONSTRAINT "Usuario_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "nexo"."Setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Importacao" ADD CONSTRAINT "Importacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "nexo"."Importacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."TipoDivergencia" ADD CONSTRAINT "TipoDivergencia_setorOrigemId_fkey" FOREIGN KEY ("setorOrigemId") REFERENCES "nexo"."Setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Divergencia" ADD CONSTRAINT "Divergencia_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "nexo"."NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Divergencia" ADD CONSTRAINT "Divergencia_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "nexo"."TipoDivergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Divergencia" ADD CONSTRAINT "Divergencia_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "nexo"."Setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Divergencia" ADD CONSTRAINT "Divergencia_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Divergencia" ADD CONSTRAINT "Divergencia_responsavelAtualId_fkey" FOREIGN KEY ("responsavelAtualId") REFERENCES "nexo"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Atribuicao" ADD CONSTRAINT "Atribuicao_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "nexo"."Divergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Atribuicao" ADD CONSTRAINT "Atribuicao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Atribuicao" ADD CONSTRAINT "Atribuicao_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "nexo"."Setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Movimentacao" ADD CONSTRAINT "Movimentacao_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "nexo"."Divergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Movimentacao" ADD CONSTRAINT "Movimentacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Movimentacao" ADD CONSTRAINT "Movimentacao_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "nexo"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Anexo" ADD CONSTRAINT "Anexo_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "nexo"."Divergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Anexo" ADD CONSTRAINT "Anexo_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "nexo"."Movimentacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Anexo" ADD CONSTRAINT "Anexo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Notificacao" ADD CONSTRAINT "Notificacao_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "nexo"."Divergencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexo"."Notificacao" ADD CONSTRAINT "Notificacao_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "nexo"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
