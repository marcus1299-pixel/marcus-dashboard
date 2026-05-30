# Oppsett — Jarvis-motor (Cloudflare Worker)

Dette er hjernen bak chat-agenten. Den holder API-nøkkelen trygt så den aldri ligger åpent i nettsiden.

## Hva du trenger
1. En gratis **Cloudflare**-konto: https://dash.cloudflare.com/sign-up
2. En **Anthropic API-nøkkel** med litt kreditt: https://console.anthropic.com → Settings → API Keys
   - Dette er pay-as-you-go (ikke abonnement). Legg på f.eks. $5 kreditt — holder lenge til personlig chat.

## Steg (ca. 10 min, i terminalen)

```bash
cd "Documents/Claude code/marcus-dashboard/worker"

# 1. Logg inn på Cloudflare (åpner nettleser)
npx wrangler login

# 2. Legg inn API-nøkkelen som hemmelighet (limes inn når den spør — vises aldri i kode)
npx wrangler secret put ANTHROPIC_API_KEY

# 3. Publiser motoren
npx wrangler deploy
```

Etter `deploy` får du en URL, f.eks.:
`https://jarvis-motor.<ditt-subdomene>.workers.dev`

**Kopier den URL-en og gi den til Claude** — så kobler vi dashbordet til motoren.

## Test at den lever
Åpne URL-en i nettleseren — du skal se "Jarvis-motor kjører. POST til /chat."
