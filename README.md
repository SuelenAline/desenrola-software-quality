# Desenrola — Software Quality

<img width="1886" height="937" alt="image" src="https://github.com/user-attachments/assets/9d03a0f3-9c26-4f9c-9a34-c20b3926157e" />

Sistema de gestão financeira pessoal desenvolvido como aplicação full stack para a disciplina Projeto de Software.

O objetivo acadêmico é desenvolver um software com três camadas: frontend, backend e banco de dados. O Desenrola foi escolhido como solução para gerenciamento financeiro pessoal e será desenvolvido de forma incremental durante as entregas da disciplina.

A aplicação possui autenticação de usuários, gerenciamento de perfil, CRUD de transações financeiras, dashboard com filtros de data e gráficos e cadastro de categorias, mantendo os dados privados por conta.

## Etapas implementadas

| Etapa | Funcionalidade entregue | Situação da implementação |
| --- | --- | --- |
| [AC1 — Cadastro e gerenciamento de lançamentos](#ac1--cadastro-e-gerenciamento-de-lançamentos) | Conta, autenticação e cadastro, consulta, edição e exclusão de receitas e despesas | Implementada |
| [AC2 — Dashboard financeiro](#ac2--dashboard-financeiro) | Totais, filtros por dia, semana e mês e gráficos diários | Implementada |
| [AC3 — Categorias e filtros](#ac3--categorias-e-filtros) | Cadastro de categorias, classificação dos lançamentos e filtro por categoria | Implementada |

### AC1 — Cadastro e gerenciamento de lançamentos

- Cadastro e login com autenticação JWT.
- Consulta e edição de perfil e exclusão da conta com confirmação de senha.
- Cadastro, listagem, edição e exclusão de receitas e despesas.
- Busca por descrição e filtro por tipo de lançamento.
- Persistência no PostgreSQL e isolamento dos dados por usuário.

**Como acessar:** entre na conta e abra **Minhas transações**. Use **Nova transação** para cadastrar um lançamento e as ações da lista para editar ou excluir.

### AC2 — Dashboard financeiro

- Total de receitas, despesas e saldo consultados no banco de dados.
- Filtros por dia, semana e mês, com uma data de referência.
- Gráficos de entradas, saídas e comparação entre entradas e saídas por dia.
- Tabela de detalhamento com valores e saldo diário.
- Atualização do resumo e apresentação adaptada para celular.

**Como acessar:** abra **Dashboard**, escolha o período e a data e clique em **Aplicar filtro**. Em **Visualização do gráfico**, selecione a análise desejada. O filtro usa a data de cadastro no fuso UTC−3; a semana vai de segunda a domingo.

### AC3 — Categorias e filtros

- Cadastro de categorias próprias de cada usuário, armazenadas no PostgreSQL.
- Seleção de categoria ao criar ou editar uma transação.
- Coluna de categoria na listagem de lançamentos.
- Filtro por categoria combinado com descrição e tipo, atualizando a lista imediatamente.
- Opção **Sem categoria** para lançamentos não classificados, incluindo os antigos.
- Validação para impedir o uso de categorias de outras contas e nomes duplicados na mesma conta.

**Como acessar:** em **Nova transação** ou na edição, preencha **Nome da categoria** no painel **Nova categoria** e clique em **Criar categoria**. Ela será selecionada automaticamente. Salve o lançamento e use **Filtrar por categoria** em **Minhas transações**.

**Validação da AC3:** 155 testes HTTP, 7 testes do frontend, teste de integração das categorias com PostgreSQL real e 3 testes de navegador aprovados na implementação.

Detalhes técnicos: [categorias dos lançamentos](#categorias-dos-lançamentos) e [dashboard financeiro](#dashboard-financeiro).

Sobre o projeto acadêmico

Este repositório corresponde ao projeto desenvolvido para a disciplina Projeto de Software. Conforme as orientações da atividade, o software deve evoluir ao longo do semestre e cada uma das quatro entregas deve apresentar uma nova funcionalidade em vídeo.

O **Desenrola** atende à proposta de desenvolvimento em três camadas, integrando interface web, API REST e persistência de dados:

| Camada             | Tecnologias utilizadas                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| **Frontend**       | HTML5, CSS3, JavaScript com ES Modules e Node.js como servidor local/proxy |
| **Backend**        | Node.js, TypeScript, NestJS, Prisma ORM e autenticação JWT                 |
| **Banco de dados** | PostgreSQL, com persistência e migrations gerenciadas pelo Prisma          |


Entregas da disciplina

## Entregas

Data

1ª AC

14/09

2ª AC

13/10

3ª AC

08/11

Entrega final / prova

22/11

Links da entrega

Substituir os campos abaixo pelos links correspondentes antes da entrega.

Repositório GitHub: https://github.com/SuelenAline/desenrola-software-quality

Board do projeto: https://github.com/users/SuelenAline/projects/1/views/1

AC1: [Vídeo do AC1](https://www.youtube.com/watch?v=OIpXee4lDQ8)
AC2: [Vídeo do AC2](https://www.youtube.com/watch?v=Zt7DHMk4vHc)
AC3: [Vídeo do AC3](https://www.youtube.com/watch?v=GF_R5L3_GfQ)

## Integrantes

Suelen Aline Ribeiro da Silva

## Funcionalidades

Cadastro e login de usuários.

Autenticação com JWT.

Consulta e edição do perfil.

Alteração de nome, e-mail e senha.

Exclusão de conta com confirmação de senha.

Cadastro de receitas e despesas.

Listagem, edição e exclusão de transações.

Busca de transações por descrição.

Filtro por tipo (Receita ou Despesa).

Cadastro, seleção e filtro por categoria.

Resumo de saldo, receitas e despesas.

Dashboard com filtros por dia, semana e mês, gráficos e detalhamento diário.

Isolamento das transações por usuário.

## Arquitetura

O projeto está dividido em frontend e backend.

O backend fornece uma API REST construída com NestJS, Prisma e PostgreSQL.

O frontend é uma interface responsiva em português. O servidor Node do frontend entrega os arquivos públicos e encaminha as chamadas de /api para o NestJS. Dessa forma, a integração funciona sem expor o segredo JWT no navegador e sem exigir liberação direta de CORS para a interface local.

desenrola/
├── backend/
├── frontend/
├── database/
│   └── docker-compose.yml
└── README.md

## Interface web

As principais telas são:

/#/login — autenticação por e-mail e senha.

/#/cadastro — criação de conta com confirmação de senha.

/#/dashboard — resumo financeiro, filtros de período e gráficos de entradas e saídas.

/#/transacoes — saldo, receitas, despesas, busca, filtros, edição e exclusão.

/#/transacoes/nova — criação de receita ou despesa, com seleção e cadastro de categoria.

/#/transacoes/editar/:id — edição de transação.

/#/perfil — consulta e alteração dos dados da conta e exclusão do usuário.

O token é armazenado em sessionStorage, ficando restrito à sessão da aba. Ao recarregar a aplicação, a conta é validada com /auth/me. O saldo considera todas as transações carregadas; busca e filtros afetam apenas a lista exibida.

## Executar localmente

Requisitos: Node.js 24, npm e PostgreSQL. O Compose incluído pode iniciar o banco com Docker.

Na raiz: docker compose -f database/docker-compose.yml up -d (dispensável se o banco já estiver em execução).

Entre em backend e execute npm ci.

Se ainda não existir .env, copie .env.example para .env e ajuste DATABASE_URL.

Configure JWT_SECRET no .env com um segredo aleatório. Gere um valor com node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))". Não versione o .env. O aplicativo recusa iniciar se o segredo estiver ausente ou tiver menos de 32 bytes.

Execute npm run prisma:generate e npm exec prisma migrate deploy.

Execute npm run start:dev.

A API responde em http://localhost:3000. O Compose usa credenciais de desenvolvimento. A configuração local .env é carregada na inicialização; variáveis já definidas no ambiente têm prioridade.

## Iniciar o frontend

Com o PostgreSQL e o backend em execução:

cd frontend
npm ci
npm run dev

Acesse http://localhost:5173. A API permanece disponível em http://localhost:3000.

Para alterar a origem da API ou a porta do frontend no PowerShell:

$env:API_ORIGIN = 'http://127.0.0.1:3000'
$env:FRONTEND_PORT = '5173'
npm start

## Autenticação

Cadastro — POST /auth/register

{
  "name": "Ana Silva",
  "email": "ana@example.com",
  "password": "Minha senha de exemplo 123!"
}

Retorna 201 com user, access_token, token_type: "Bearer" e expires_in: 3600.

O nome deve ter entre 2 e 100 caracteres. O e-mail é normalizado para minúsculas e não pode se repetir. A senha deve ter entre 8 e 128 caracteres e é armazenada somente como hash scrypt com salt aleatório. A API não retorna a senha nem o hash. Campos adicionais são rejeitados.

Login — POST /auth/login

{
  "email": "ana@example.com",
  "password": "Minha senha de exemplo 123!"
}

Retorna 200 com os mesmos campos de sessão do cadastro. E-mail ou senha incorretos retornam 401; e-mail duplicado no cadastro retorna 409. Entradas inválidas retornam 400.

O token expira em uma hora. Faça login novamente para obter outro token; não há refresh token neste fluxo. Envie o token em todas as rotas de transações:

Authorization: Bearer SEU_ACCESS_TOKEN

Exemplo no PowerShell, depois de cadastrar a conta:

$loginBody = @{
  email = 'ana@example.com'
  password = 'Minha senha de exemplo 123!'
} | ConvertTo-Json

$session = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/login' -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = "Bearer $($session.access_token)" }
Invoke-RestMethod -Uri 'http://localhost:3000/transactions' -Headers $headers

Todas as rotas de /auth, incluindo cadastro, login e gerenciamento da conta, compartilham um limite de 10 requisições por minuto por IP, retornando 429 quando excedido. O contador fica na memória de cada instância. O servidor não confia em cabeçalhos de proxy por padrão; uma implantação com proxy ou múltiplas instâncias precisa configurar o IP do cliente e armazenamento compartilhado do limitador. Use HTTPS na implantação pública.

## Transações

Todas as rotas abaixo exigem autenticação e operam apenas nas transações da conta autenticada.

Método

Rota

Resultado

GET

/transactions

Lista das transações do usuário

GET

/transactions/:id

Transação pelo ID

POST

/transactions

Criação (201)

PUT

/transactions/:id

Substituição dos campos da transação

DELETE

/transactions/:id

Exclusão

Corpo de POST e PUT:

{"description":"Mercado","amount":100.50,"type":"Despesa"}

description deve conter texto não vazio; espaços nas extremidades são removidos. amount é um número entre 0 e 99999999.99, com até duas casas decimais. type aceita Receita ou Despesa. O dono é definido pelo token; enviar userId no corpo é rejeitado. O Prisma serializa o Decimal de amount como string nas respostas JSON.

IDs devem ser inteiros positivos de até 2147483647. Entradas inválidas retornam 400. Token ausente, inválido ou expirado retorna 401. Transações inexistentes ou pertencentes a outra conta retornam 404, inclusive em atualização e exclusão.

GET / continua público e retorna a mensagem de funcionamento.

Migração das transações anteriores à autenticação

A migração 20260914164000_user_auth cria a tabela User e a coluna Transaction.userId, com índice e chave estrangeira. Os registros antigos são preservados com userId = NULL e ficam inacessíveis pela API. Eles precisam ser vinculados explicitamente à conta correta no banco depois de verificar a propriedade. Nenhuma transação antiga é atribuída automaticamente a um novo cadastro.

## Verificações

Execute dentro de backend:

npm run typecheck: verifica os tipos, incluindo testes e configurações.

npm run build: compila a aplicação.

npm test: testes unitários Vitest.

npm run test:e2e: teste HTTP básico com Vitest.

npm run test:http: compila e executa testes HTTP de autenticação, isolamento de usuários, validação, CRUD, dashboard e categorias, com persistência simulada. Não precisa de banco.

npm run test:db: compila e executa testes de cadastro, login, isolamento, alteração de dados, exclusão da conta e persistência de categorias no PostgreSQL local configurado em .env. Exige as migrações aplicadas. Cria contas e registros temporários; remove somente os dados criados pelo próprio teste ao terminar.

npm run lint: análise Oxlint.

Vitest e Oxlint utilizam componentes nativos que podem ser bloqueados pelo Controle de Aplicativo do Windows. Nesse caso, os comandos podem falhar antes de analisar o código; a política do sistema precisa permitir esses componentes para executá-los.

## Frontend

Execute dentro de frontend:

npm run check
npm test
npm run test:e2e

Os testes unitários verificam valores monetários, filtros, escape de texto e o proxy. Os testes de navegador usam Playwright. Eles exigem o backend configurado, as migrações aplicadas no PostgreSQL local e não devem ser executados contra banco remoto.

Limitações identificadas na análise

A auditoria de dependências de 14/09/2026 reportou oito alertas (cinco altos, um moderado e dois baixos), nas cadeias de prisma/deepmerge-ts e @nestjs/mau/tmp/undici. A instalação das dependências de autenticação manteve essa contagem. npm audit fix não resolveu esses alertas dentro das versões compatíveis. A sugestão com --force rebaixa dependências diretas e exige avaliação de compatibilidade; não foi aplicada.

Referências da implementação

scrypt e comparação de hashes no Node.js.

Assinatura e verificação JWT com jose.

Limitação de requisições com express-rate-limit.

## Categorias dos lançamentos

No formulário de uma transação, use **Nova categoria** para cadastrar uma categoria
e selecioná-la automaticamente. A seleção também pode ser alterada ao editar o
lançamento. Registros antigos permanecem como **Sem categoria**.

Na listagem, **Filtrar por categoria** combina-se com a busca por descrição e o
filtro de tipo, atualizando a lista imediatamente. Categorias e lançamentos são
carregados do banco; os cartões de resumo continuam representando o total da conta.

As rotas autenticadas `GET /categories` e `POST /categories` listam e cadastram
categorias privadas do usuário. O nome tem até 80 caracteres e não pode se repetir
na mesma conta (ignorando maiúsculas e espaços excedentes). `POST /transactions` e
`PUT /transactions/:id` aceitam `categoryId` ou `null` para remover a classificação.
Categorias de outras contas não podem ser usadas.

Para atualizar outra instalação, execute `npx prisma migrate deploy` e
`npx prisma generate` em `backend`, depois reinicie a API. A migração de categorias
preserva os lançamentos existentes.

## Dashboard financeiro

Acesse **Dashboard** no menu lateral (`/#/dashboard`) para consultar receitas,
despesas e saldo dos lançamentos do usuário autenticado no período selecionado. Os valores são
exibidos em reais; o botão **Atualizar resumo** consulta novamente o banco.

O endpoint autenticado `GET /transactions/summary` agrega os valores no PostgreSQL
por tipo e usuário, e retorna `income`, `expense` e `balance` como strings decimais
com duas casas. O saldo é calculado como receitas menos despesas. Uma conta sem
lançamentos retorna `"0.00"` nos três campos. Não é necessária nova migração.

O Dashboard inicia no mês atual e permite filtrar por dia, semana (segunda a
domingo) ou mês, usando uma data de referência. A data considerada é `createdAt`,
em fuso fixo UTC−3. Totais e gráficos usam o mesmo período.

`GET /transactions/dashboard?period=month&date=2026-10-13` consulta somente os
lançamentos do usuário no intervalo e retorna os totais e a série `daily`, incluindo
dias zerados. `period` aceita `day`, `week` e `month`. Os gráficos permitem visualizar
entradas, saídas ou ambas por dia, com tabela de valores e saldo diário.

Execute `npm run test:dashboard` em `frontend` para testar filtros, gráficos,
estados de erro e layout móvel no navegador com API simulada, sem depender do banco.
