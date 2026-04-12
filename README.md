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
  --region southamerica-east1 `
  --allow-unauthenticated `
  --set-env-vars CORS_ORIGINS=https://advocacia-sistema-80239.web.app,https://advocacia-sistema-80239.firebaseapp.com,FIREBASE_PROJECT_ID=advocacia-sistema-80239,FIREBASE_STORAGE_BUCKET=advocacia-sistema-80239.firebasestorage.app
```

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

## Observacoes

- Em producao, o frontend usa chamadas relativas para `/api`, entao o Firebase Hosting encaminha essas rotas para o Cloud Run.
- O backend ja aceita os dominios padrao `web.app` e `firebaseapp.com` do projeto, alem de `localhost`.
- Para preview channels do Firebase Hosting, o backend tambem aceita dominios `https://advocacia-sistema-80239--<canal>.web.app`.
