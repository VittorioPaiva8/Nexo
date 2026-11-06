# Nexo — controle de NF-es divergentes

Sistema para importar NF-es, marcar as que deram problema, encaminhar cada uma ao responsável e medir quanto tempo as notas ficam paradas com cada pessoa e setor.

Segue o **Padrão de Desenvolvimento ITAX** (projeto de referência: ITAX 5S) e o manual de identidade visual **ITAX-ID-001**.

## Como funciona

Fluxo **Fluxo Fiscal**, conforme o manual do gestor e o protótipo "ITAX | Fluxo Fiscal":

1. **Cadastrar**: o Fiscal registra a divergência, a partir de notas importadas (XML), de uma nota digitada à mão ou de um **lote CSV** com prévia linha a linha. Cada divergência ganha um protocolo `DF-AAAA-NNNN`, prioridade, prazo e um responsável do setor escolhido. A mesma NF com o mesmo tipo não pode ter duas divergências abertas.
2. **Tratar**: o responsável vê o item em _Minhas tratativas_, **assume** (status _Em tratamento_), pode salvar rascunho e **devolve ao Fiscal** com a devolutiva, o tipo de solução e as evidências anexadas (XML, PDF, JPG ou PNG, até 5 de 10 MB).
3. **Validar**: o Fiscal confere em _Validação fiscal_ e **conclui** com um parecer ou **reabre** (com novo responsável e prazo, se quiser). Também pode **redistribuir** um item pendente ou em tratamento.
4. **Acompanhar**: _Painel geral_ e _Relatórios e SLA_ mostram abertas, vencidas, SLA por setor, tempo com cada setor e responsável, idade da fila, motivos recorrentes e reincidência por fornecedor, com exportação CSV.

Status: `PENDENTE → EM_TRATAMENTO → DEVOLVIDA → CONCLUIDA`. "Atrasada" não é gravada: vale quando o prazo (dia, horário de Brasília) passou e o item ainda está com o setor. O SLA é cumprido quando a divergência é concluída até o fim do dia do prazo.

Cada passagem por um responsável é uma `Atribuicao` (início e fim), e a soma dá o tempo por pessoa e por setor, em horas corridas. Todas as ações ficam no histórico (`Movimentacao`).

Avisos (nova atribuição, devolução, escalonamento na reabertura) ficam gravados e aparecem no sino. O envio por e-mail ainda não está ligado (sem SMTP), por isso ficam como _não enviada_. O aviso de prazo próximo precisa de uma rotina agendada e está desligado por padrão.

### Perfis

| Perfil   | Pode                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| FISCAL   | Cadastrar e importar divergências, validar, concluir, reabrir e redistribuir, relatórios |
| TRATADOR | Ver as tratativas do próprio setor, assumir, salvar rascunho e devolver com evidências   |
| GESTOR   | O mesmo que o Fiscal, em todos os setores                                                |
| ADMIN    | Tudo, inclusive usuários, setores (com SLA), tipos de divergência e avisos               |

O controle de acesso é verificado no backend (`PerfisGuard` + regras em `src/divergencias/regras.ts`).

### Importação CSV

Separador `;`, com cabeçalho. Colunas obrigatórias: `numero_nf`, `serie`, `cnpj_emissor`, `fornecedor`, `valor_total`, `tipo_divergencia`, `setor`, `responsavel` (nome ou e-mail), `descricao`. Opcionais: `chave_acesso`, `data_emissao`, `pedido_compra`, `centro_custo`, `unidade`, `prioridade`, `prazo`. A tela mostra a prévia com os erros de cada linha antes de gravar.

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

Usuários do seed (senha `nexo123`, ou o valor de `SEED_SENHA`): `admin@`, `fiscal@`, `gestor@`, `suprimentos@`, `compras@`, `financeiro@` e `obras@nexo.local`. Com `SEED_DEMO=true` (e nenhuma divergência gravada) o seed também cria 10 divergências de exemplo em todos os status. Troque as senhas antes de qualquer uso real.

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

## Publicação (ambiente de teste)

O ambiente de teste roda no **Cloudflare**, num único endereço: o frontend é servido como arquivos estáticos e a API roda em **Cloudflare Containers**, acessada em `/api`. O banco é um PostgreSQL gratuito no **Neon** (o Supabase também funciona, com a conexão do Session pooler). Isso é uma exceção ao guia ITAX (que prevê Fly.io para API e banco), aprovada só para o teste. O `Dockerfile` é o mesmo nos dois casos.

O workflow `.github/workflows/publicar.yml` roda a cada push na `main` (ou manualmente em Actions → Publicar): aplica as migrações no banco, carrega o seed, gera o frontend e publica com `wrangler deploy` (`wrangler.jsonc` e `cloudflare/worker.ts`).

Segredos do repositório (Settings → Secrets and variables → Actions):

| Nome                    | Onde conseguir                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare → My Profile → API Tokens → modelo _Edit Cloudflare Workers_                              |
| `CLOUDFLARE_ACCOUNT_ID` | Painel da Cloudflare, na página inicial da conta                                                     |
| `DATABASE_URL`          | Neon → projeto → Connect, com _Connection pooling_ desligado (conexão direta, com `sslmode=require`) |

Requisitos: plano Workers Paid na Cloudflare (necessário para Containers). O container desliga após 15 minutos sem uso; o primeiro acesso depois disso leva alguns segundos.

As tabelas ficam no schema `nexo` do PostgreSQL, então o Nexo pode usar um banco que já tenha outras tabelas, sem misturar com elas.

Antes do uso real: troque as senhas dos usuários do seed, defina a variável `SEED_AO_PUBLICAR=false` e configure o backup do banco.

## Identidade visual

- Login com fundo preto e degradê vermelho; cabeçalho em `#1A1A1A`; área de trabalho clara.
- Vermelho Itax `#E40B18` só em ações primárias, pendências e alertas; verde e amarelo para sucesso e atenção.
- Fonte Plus Jakarta Sans, cantos de 12px, ícones em traço (Tabler).
- O logotipo oficial deve ser colocado em `web/public/grupo-itax-logo-branca.svg`; ele aparece no cabeçalho e no login automaticamente. O sistema não recria nem recolore o logo.
