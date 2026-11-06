# Nexo — controle de NF-es divergentes

Sistema para importar NF-es, marcar as que deram problema, encaminhar cada uma ao responsável e medir quanto tempo as notas ficam paradas com cada pessoa e setor.

Segue o **Padrão de Desenvolvimento ITAX** (projeto de referência: ITAX 5S) e o manual de identidade visual **ITAX-ID-001**.

## Como funciona

1. **Importar**: o revisor envia os XMLs (até 500 por vez). Chaves já importadas são ignoradas e arquivos que não são NF-e aparecem com o motivo.
2. **Marcar e encaminhar**: o revisor seleciona as notas com problema, escolhe o tipo de divergência, descreve o ajuste e escolhe o responsável. O relógio do responsável começa a contar.
3. **Responder**: o responsável vê a nota em _Minhas pendências_ e responde com uma **justificativa** ou a **correção** feita. Se não for com ele, **repassa** para outra pessoa ou setor.
4. **Revisar**: o retorno volta para quem pediu, que **aceita** (divergência resolvida) ou **devolve** pedindo novo ajuste.
5. **Painel**: setores que mais seguram notas, tempo médio de nota aberta, tempo médio até resolver, idade das pendências, tipos mais comuns e taxa de reabertura.

Cada passagem da nota por um responsável é uma `Atribuicao` (início e fim). A soma desses períodos dá o tempo por pessoa e por setor. O tempo é contado em **horas corridas**.

### Perfis

| Perfil      | Pode                                                                  |
| ----------- | --------------------------------------------------------------------- |
| ADMIN       | Tudo, inclusive cadastros de usuários, setores e tipos de divergência |
| REVISOR     | Importar, marcar e encaminhar, aceitar/devolver, ver o painel         |
| RESPONSAVEL | Ver as próprias pendências, responder e repassar                      |

O controle de acesso é verificado no backend (`PerfisGuard` + regras em `src/divergencias/regras.ts`).

## Stack

| Camada    | Padrão                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------- |
| Backend   | Node.js 24 LTS, TypeScript (ESM), NestJS, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 16        |
| API       | REST, DTOs com class-validator, JWT + Passport, bcrypt, Swagger em `/docs`, contrato em `docs/` |
| Frontend  | React 19 + Vite 8 em `web/`, Mantine, Tabler Icons, React Router, Day.js (DD/MM/AAAA)           |
| Testes    | Vitest (unitários) + Supertest (e2e); Vitest + Testing Library no frontend                      |
| Qualidade | Oxlint + Prettier                                                                               |

Leitura do XML da NF-e: `fast-xml-parser` (dependência adicional ao padrão, necessária para o domínio).

## Primeiros passos

Pré-requisitos: Node.js 24 LTS, npm, Docker.

```bash
npm install                 # backend (gera o Prisma Client)
cd web && npm install && cd ..
npm run db:up               # PostgreSQL 16 em container
cp .env.example .env        # preencha JWT_SECRET
cp web/.env.example web/.env
npx prisma migrate dev      # cria as tabelas
npm run seed                # setores, tipos de divergência e usuários de exemplo
npm run start:dev           # API em http://localhost:3000 (Swagger em /docs)
cd web && npm run dev       # frontend em http://localhost:5173
```

Usuários do seed (senha `nexo123`, ou o valor de `SEED_SENHA`): `admin@nexo.local`, `revisor@nexo.local`, `compras@nexo.local`, `financeiro@nexo.local`, `logistica@nexo.local`. Troque as senhas antes de qualquer uso real.

## Scripts

| Comando                | O que faz                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run start:dev`    | API com recarga automática                                         |
| `npm run build`        | Compila a API para `dist/`                                         |
| `npm test`             | Testes unitários do backend                                        |
| `npm run test:e2e`     | Testes e2e (usa `DATABASE_URL_TESTE`, que é limpo a cada execução) |
| `npm run openapi`      | Regera `docs/nexo-openapi.yml` a partir dos controllers e DTOs     |
| `npm run lint`         | Oxlint no backend e no frontend                                    |
| `npm run format:check` | Prettier                                                           |
| `cd web && npm test`   | Testes do frontend                                                 |

## Estrutura

| Caminho                 | Conteúdo                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `src/`                  | Backend NestJS, um módulo por domínio (controller → service → Prisma) |
| `src/notas/`            | Importação e leitura dos XMLs (`nfe-parser.ts`)                       |
| `src/divergencias/`     | Fluxo de encaminhamento, resposta, repasse, aceite e devolução        |
| `src/metricas/`         | Cálculo dos indicadores do painel (`calculo.ts`)                      |
| `prisma/schema.prisma`  | Modelagem do banco                                                    |
| `prisma/seed.ts`        | Dados iniciais                                                        |
| `test/`                 | Testes e2e (Supertest)                                                |
| `web/`                  | Frontend React + Vite                                                 |
| `docs/nexo-openapi.yml` | Contrato OpenAPI                                                      |

## Antes de cada commit

- [ ] `npm run lint` e `npm run format:check` sem erro
- [ ] Nenhum segredo nem `.env` no git
- [ ] Mudança no banco feita por migração Prisma
- [ ] Mudança de endpoint refletida em `docs/nexo-openapi.yml` (`npm run openapi`)

## Identidade visual

- Login com fundo preto e degradê vermelho; cabeçalho em `#1A1A1A`; área de trabalho clara.
- Vermelho Itax `#E40B18` só em ações primárias, pendências e alertas; verde e amarelo para sucesso e atenção.
- Fonte Plus Jakarta Sans, cantos de 12px, ícones em traço (Tabler).
- O logotipo oficial deve ser colocado em `web/public/grupo-itax-logo-branca.svg`; ele aparece no cabeçalho e no login automaticamente. O sistema não recria nem recolore o logo.
