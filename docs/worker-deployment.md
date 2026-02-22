# Worker Deployment (Hybrid Queue-First)

Revio runs API/webhooks on Vercel and queue workers on a separate always-on service.

## 1) Required runtime split

- Web/API: Vercel (`npm run build` + `npm run start`)
- Worker service (Railway/Render/Fly/etc): `npm run worker`

## 2) Required environment variables on worker service

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `GOOGLE_AI_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `BACKGROUND_MODE=hybrid`

## 3) Health verification after deploy

From the Vercel app:

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/health/deps`

From logs:

- Worker logs should show queue consumption for `indexing` and `pr-review`.
- Webhook pushes to default branch should enqueue `index:*` jobs.
- PR open/sync events should enqueue `review:*` jobs.

## 4) Fallback behavior

- If queue enqueue fails and `BACKGROUND_MODE=hybrid`, Revio falls back to `after()` execution.
- If strict queue-only behavior is desired, set `BACKGROUND_MODE=queue`.
- Emergency rollback mode: `BACKGROUND_MODE=serverless`.
