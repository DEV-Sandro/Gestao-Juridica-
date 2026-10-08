# JustaPro

Aplicacao com frontend Angular no Firebase Hosting e backend Node.js/Express no Cloud Run.

## Estrutura

- `front`: SPA Angular publicada no Firebase Hosting.
- `backend`: API Express publicada no Cloud Run.
- `scripts`: scripts auxiliares do projeto.

## GitHub

Este projeto pode ser conectado ao repositorio de teste:

`https://github.com/DEV-Sandro/Gestao-Juridica-.git`

## Deploy

### 1. Publicar a API no Cloud Run

Use o projeto Firebase/GCP `advocacia-sistema-80239` e publique o backend com o servico `gestao-juridica-api`:

```powershell
gcloud run deploy gestao-juridica-api `
  --source backend `
  --project advocacia-sistema-80239 `
  --region southamerica-east1
```

O comando acima preserva as permissÃµes e variÃ¡veis do serviÃ§o que jÃ¡ estÃ¡ em produÃ§Ã£o. Use `--allow-unauthenticated` somente na criaÃ§Ã£o inicial do serviÃ§o, se a API for ser atendida pelo Firebase Hosting.

### 2. Gerar o build do frontend

```powershell
Set-Location front
npm install
npm run build
Set-Location ..
```

### 3. Publicar no Firebase Hosting

```powershell
firebase deploy --only hosting --project advocacia-sistema-80239
```

## Multi-tenant e Fila de Acao

- O modelo v2 usa `tenants/{tenantId}` como raiz e subcolecoes `members`, `clients`, `processes`, `deadlines` e `timeEntries`.
- As regras e os indices estao em `firestore.rules` e `firestore.indexes.json`. Publique-os com `firebase deploy --only firestore:rules,firestore:indexes --project advocacia-sistema-80239`.
- A migracao e aditiva: primeiro execute `npm run tenant:migrate-subcollections` dentro de `backend` para conferir a contagem; apenas depois use `npm run tenant:migrate-subcollections -- --apply`. Ela preserva as colecoes legadas.
- Para atualizar o risco dos prazos, configure `RISK_CRON_SECRET` no Cloud Run e crie uma tarefa horaria do Cloud Scheduler para `POST /api/integracoes/prazos/recalcular-risco`, enviando o segredo no cabecalho `x-risk-cron-secret`.

### Radar de risco operacional

- Prazos criados na agenda (`tipo: PRAZO`) agora guardam confirmação de ciência no servidor, por usuário e data; ela deixa de depender do navegador. Alterar a data, o responsável, os participantes ou o status exige uma nova confirmação.
- O orquestrador agenda alerta em 48h e escalonamento em 12h pelo Cloud Tasks. Cada tarefa carrega a versão e o vencimento do prazo; se o prazo for concluído, removido, confirmado ou reagendado, ela é ignorada com segurança. O alerta vai ao responsável e participantes; o escalonamento vai aos administradores ativos do mesmo escritório.
- Para ativar, habilite a API Cloud Tasks, crie a fila e configure no Cloud Run: `DEADLINE_TASKS_QUEUE`, `DEADLINE_TASKS_WEBHOOK_URL`, `DEADLINE_TASK_SECRET` e, se a API exigir IAM, `DEADLINE_TASKS_SERVICE_ACCOUNT`. Opcionalmente defina `DEADLINE_TASKS_PROJECT` e `DEADLINE_TASKS_LOCATION` (padrão `southamerica-east1`). A conta do Cloud Run precisa de `roles/cloudtasks.enqueuer` e a conta OIDC de `roles/run.invoker`.
- O webhook é `POST /api/integracoes/prazos/tarefas`; o status da integração pode ser consultado em `GET /api/integracoes/prazos/status`. E-mail e WhatsApp reutilizam as variáveis já descritas em **Agenda e integrações**.

## Motor incremental de rentabilidade

- Todo novo processo recebe uma projeção financeira inicial. Ao registrar ou remover um apontamento de tempo, a API atualiza `totalSeconds`, `totalCost`, `profitabilityMargin` e `profitabilityStatus` na mesma transação do Firestore.
- O apontamento grava `durationSeconds` e `costRateSnapshot`; use `custoHora` no payload quando houver uma taxa específica para a atividade. Sem uma taxa informada, a API usa a taxa configurada no processo, se existir, ou mantém o custo como zero.
- Para processos já existentes, execute primeiro `npm run rentabilidade:rebuild-projections` dentro de `backend`. Após conferir a contagem, aplique com `npm run rentabilidade:rebuild-projections -- --apply`. É uma migração aditiva e não altera nem remove os apontamentos históricos.
- Enquanto o backfill não é aplicado, a tela mantém a leitura legada para não apresentar horas parciais. Depois dele, lê somente os totais do processo e os últimos ajustes para a lista visual.
- Antes de aplicar o backfill em produção, publique também o índice de `apontamentosTempo` com `firebase deploy --only firestore:indexes --project advocacia-sistema-80239`.

## Observacoes

- Em producao, o frontend usa chamadas relativas para `/api`, entao o Firebase Hosting encaminha essas rotas para o Cloud Run.
- O backend ja aceita os dominios padrao `web.app` e `firebaseapp.com` do projeto, alem de `localhost`.
- Para preview channels do Firebase Hosting, o backend tambem aceita dominios `https://advocacia-sistema-80239--<canal>.web.app`.

## Agenda e integraÃ§Ãµes

- Compromissos podem ter participantes, recorrÃªncia semanal/quinzenal/mensal e lembretes por e-mail e WhatsApp.
- A opÃ§Ã£o **Baixar para Google/Outlook** gera um arquivo `.ics`, aceito por ambos os calendÃ¡rios. A sincronizaÃ§Ã£o bidirecional por OAuth Ã© uma prÃ³xima etapa e exige o registro do aplicativo no Google e na Microsoft.
- Para e-mails, configure `RESEND_API_KEY` e `REMINDER_FROM_EMAIL` no Cloud Run. Para WhatsApp, configure `WHATSAPP_WEBHOOK_URL` e, se aplicÃ¡vel, `WHATSAPP_WEBHOOK_TOKEN` com o endpoint do provedor escolhido.
- O processamento automÃ¡tico requer `REMINDER_CRON_SECRET` no Cloud Run e uma tarefa do Cloud Scheduler que execute `POST /api/integracoes/lembretes/processar` com esse valor no cabeÃ§alho `x-reminder-secret`. O endpoint fica protegido e nÃ£o processa lembretes sem esse segredo.
