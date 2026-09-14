# Frontend Desenrola

Interface responsiva em português para login, cadastro, perfil e transações. Usa HTML, CSS e JavaScript modular. O servidor Node serve os arquivos públicos e encaminha `/api` ao NestJS, permitindo a integração sem liberar CORS ou expor o segredo JWT no navegador.

## Executar

Com PostgreSQL e backend em execução na porta 3000:

```powershell
cd frontend
npm ci
npm run dev
```

Abra **http://localhost:5173**. `npm start` também inicia o servidor, sem modo watch. Não é necessário compilar os arquivos do frontend.

Para alterar a conexão no PowerShell:

```powershell
$env:API_ORIGIN = 'http://127.0.0.1:3000'
$env:FRONTEND_PORT = '5173'
npm start
```

O servidor escuta apenas no computador local. Para publicação, configure hospedagem HTTPS e um proxy de mesma origem para a API. O segredo JWT permanece exclusivamente no backend.

## Telas

- `/#/login`: autenticação por e-mail e senha.
- `/#/cadastro`: cadastro com confirmação de senha.
- `/#/transacoes`: resumo de saldo, receitas e despesas; busca por descrição, filtro por tipo, edição e exclusão.
- `/#/transacoes/nova`: criação de receita ou despesa.
- `/#/transacoes/editar/:id`: edição de transação.
- `/#/perfil`: consulta e alteração de nome, e-mail e senha; exclusão da conta com confirmação de senha.

As operações usam a API real. O token é armazenado em `sessionStorage`, restrito à sessão da aba. Recarregar a página valida a conta com `/auth/me`. Sair remove a sessão local; tokens inválidos ou revogados levam à tela de login. Uma senha atual incorreta no perfil mantém o formulário aberto para correção.

O saldo considera todas as transações carregadas; os filtros afetam apenas a lista. Valores são exibidos em reais. Digite valores sem separador de milhar, usando vírgula ou ponto para centavos. A data exibida é a data de criação registrada pelo backend.

Excluir uma conta remove permanentemente suas transações. O frontend solicita confirmação e senha antes de enviar a requisição.

## Verificações

```powershell
npm run check
npm test
npm run test:e2e
```

Os testes unitários verificam valores monetários, filtros, escape de texto e o proxy. Os testes de navegador usam Playwright e o Chrome instalado no Windows; é possível definir `CHROME_PATH` ou instalar o Chromium do Playwright com `npx playwright install chromium`.

Os testes de navegador exigem `../backend/.env`, dependências do backend instaladas e migrações aplicadas no PostgreSQL local. Usam portas separadas (3101 e 5174), criam contas temporárias e removem apenas os registros dessas contas ao finalizar. Não execute contra banco remoto. As capturas ficam em `test-results/`, ignorado pelo Git.

O limite de requisições de `/auth` do backend também se aplica ao frontend; se excedido, a tela orienta aguardar um minuto.
