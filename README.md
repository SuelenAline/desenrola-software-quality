# Desenrola — Software Quality

 <img width="1901" height="947" alt="image" src="https://github.com/user-attachments/assets/62261735-e0aa-4742-970c-8dce750e9442" />



Sistema de gestão financeira pessoal desenvolvido como aplicação full stack para a disciplina Projeto de Software.

O objetivo acadêmico é desenvolver um software com três camadas: frontend, backend e banco de dados. O Desenrola foi escolhido como solução para gerenciamento financeiro pessoal e será desenvolvido de forma incremental durante as entregas da disciplina.

A aplicação possui autenticação de usuários, gerenciamento de perfil e CRUD de transações financeiras, mantendo os dados privados por conta.

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

Resumo de saldo, receitas e despesas.

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

/#/transacoes — saldo, receitas, despesas, busca, filtros, edição e exclusão.

/#/transacoes/nova — criação de receita ou despesa.

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

npm run test:http: compila e executa 114 testes HTTP de autenticação, isolamento de usuários, validação e CRUD, com persistência simulada. Não precisa de banco.

npm run test:db: compila e executa dois testes de cadastro, login, isolamento, alteração de dados e exclusão da conta no PostgreSQL local configurado em .env. Exige as migrações aplicadas. Cria duas contas temporárias e transações; remove somente os dados criados pelo próprio teste ao terminar.

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
