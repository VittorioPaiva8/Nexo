-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'REVISOR', 'RESPONSAVEL');

-- CreateEnum
CREATE TYPE "StatusNota" AS ENUM ('IMPORTADA', 'EM_AJUSTE', 'AJUSTADA');

-- CreateEnum
CREATE TYPE "StatusDivergencia" AS ENUM ('PENDENTE', 'AGUARDANDO_REVISAO', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('SOLICITACAO', 'JUSTIFICATIVA', 'CORRECAO', 'REPASSE', 'DEVOLUCAO', 'ACEITE');

-- CreateEnum
CREATE TYPE "MotivoFimAtribuicao" AS ENUM ('RESPONDIDA', 'REPASSADA');

-- CreateTable
CREATE TABLE "Setor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'RESPONSAVEL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "setorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Importacao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalArquivos" INTEGER NOT NULL,
    "totalImportadas" INTEGER NOT NULL,
    "totalDuplicadas" INTEGER NOT NULL,
    "totalInvalidas" INTEGER NOT NULL,

    CONSTRAINT "Importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" SERIAL NOT NULL,
    "chaveAcesso" CHAR(44) NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "emitenteCnpj" TEXT NOT NULL,
    "emitenteNome" TEXT NOT NULL,
    "destinatarioDoc" TEXT,
    "destinatarioNome" TEXT,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "naturezaOperacao" TEXT,
    "xml" TEXT NOT NULL,
    "status" "StatusNota" NOT NULL DEFAULT 'IMPORTADA',
    "importacaoId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDivergencia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoDivergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Divergencia" (
    "id" SERIAL NOT NULL,
    "notaFiscalId" INTEGER NOT NULL,
    "tipoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusDivergencia" NOT NULL DEFAULT 'PENDENTE',
    "solicitanteId" INTEGER NOT NULL,
    "responsavelAtualId" INTEGER,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidaEm" TIMESTAMP(3),

    CONSTRAINT "Divergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atribuicao" (
    "id" SERIAL NOT NULL,
    "divergenciaId" INTEGER NOT NULL,
    "responsavelId" INTEGER NOT NULL,
    "setorId" INTEGER,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "motivoFim" "MotivoFimAtribuicao",

    CONSTRAINT "Atribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" SERIAL NOT NULL,
    "divergenciaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipo" "TipoMensagem" NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chaveAcesso_key" ON "NotaFiscal"("chaveAcesso");

-- CreateIndex
CREATE INDEX "NotaFiscal_status_idx" ON "NotaFiscal"("status");

-- CreateIndex
CREATE INDEX "NotaFiscal_emitenteCnpj_idx" ON "NotaFiscal"("emitenteCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDivergencia_nome_key" ON "TipoDivergencia"("nome");

-- CreateIndex
CREATE INDEX "Divergencia_status_idx" ON "Divergencia"("status");

-- CreateIndex
CREATE INDEX "Divergencia_responsavelAtualId_status_idx" ON "Divergencia"("responsavelAtualId", "status");

-- CreateIndex
CREATE INDEX "Divergencia_solicitanteId_status_idx" ON "Divergencia"("solicitanteId", "status");

-- CreateIndex
CREATE INDEX "Atribuicao_divergenciaId_idx" ON "Atribuicao"("divergenciaId");

-- CreateIndex
CREATE INDEX "Atribuicao_setorId_idx" ON "Atribuicao"("setorId");

-- CreateIndex
CREATE INDEX "Atribuicao_responsavelId_idx" ON "Atribuicao"("responsavelId");

-- CreateIndex
CREATE INDEX "Mensagem_divergenciaId_idx" ON "Mensagem"("divergenciaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importacao" ADD CONSTRAINT "Importacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divergencia" ADD CONSTRAINT "Divergencia_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divergencia" ADD CONSTRAINT "Divergencia_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoDivergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divergencia" ADD CONSTRAINT "Divergencia_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divergencia" ADD CONSTRAINT "Divergencia_responsavelAtualId_fkey" FOREIGN KEY ("responsavelAtualId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atribuicao" ADD CONSTRAINT "Atribuicao_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "Divergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atribuicao" ADD CONSTRAINT "Atribuicao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atribuicao" ADD CONSTRAINT "Atribuicao_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_divergenciaId_fkey" FOREIGN KEY ("divergenciaId") REFERENCES "Divergencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
