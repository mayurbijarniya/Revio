# Revio: Context-Aware AI Code Reviewer

**Engineering high-quality code through semantic codebase intelligence.**

Revio is a high-performance, context-aware code review agent built for modern engineering teams. Unlike standard AI linters, Revio implements a **Retrieval-Augmented Generation (RAG)** pipeline over your entire codebase to provide reviews that understand your internal abstractions, design patterns, and architectural invariants.

## Key Technical Features

- **Semantic Codebase Intelligence**: Uses vector embeddings (Qdrant) to index your entire repository, enabling the AI to "know" your codebase before it reviews a single line of a PR.
- **Context-Aware PR Analysis**: Automatically retrieves relevant cross-file context (shared types, utility functions, usage patterns) to minimize false positives and provide actionable feedback.
- **Natural Language Code Search**: Implements semantic search over code chunks, allowing developers to query the codebase using intent (e.g., *"Where do we handle cross-origin auth?"*) rather than just keyword matches.
- **Security & Best Practices**: Automated AST-aware scanning combined with LLM reasoning to detect complex logical vulnerabilities and architectural drifts.
- **Automated Workflow**: Native GitHub App integration with event-driven triggers (webhooks) and background job processing (BullMQ/Redis).

## Technical Architecture

Revio is designed as a modular, event-driven system:

1.  **Ingestion Engine**: Extracts code from GitHub, chunks it using AST-aware dividers, and generates vector embeddings via `text-embedding-3-small` (or Gemini equivalent).
2.  **Vector Store (Qdrant)**: Stores high-dimensional code representations for sub-millisecond similarity searches.
3.  **Review Orchestrator**: 
    - Triggered by GitHub `pull_request` webhooks.
    - Performs **Context Retrieval**: Identifies modified files and fetches semantically related code from the vector store.
    - **Reasoning Loop**: Feeds the diff + retrieved context into a high-reasoning LLM (Gemini 1.5 Pro / GPT-4o) with a specialized system prompt.
4.  **Feedback Loop**: Posts results as high-fidelity GitHub inline comments or summary reviews.

## Tech Stack

- **Frontend/API**: Next.js 15 (App Router, Server Actions)
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL (Prisma ORM)
- **Vector Intelligence**: Qdrant
- **Message Queue**: BullMQ (Redis)
- **AI Models**: Google Gemini 1.5 Pro / Flash, OpenAI GPT-4o
- **Auth & API**: Octokit (GitHub App Architecture)

## Getting Started

### Prerequisites

- **Node.js**: >= 20.11.0
- **PostgreSQL**: e.g., Supabase or local instance
- **Redis**: Required for BullMQ background workers
- **Qdrant**: Local Docker instance or Qdrant Cloud

### Installation

```bash
# 1. Clone & Install
git clone https://github.com/mayurbijarniya/Revio.git && cd Revio
npm install

# 2. Infrastructure Setup
cp .env.example .env
# Edit .env with your credentials

# 3. Database & Indexing
npx prisma db push
npx prisma generate

# 4. Run Development
npm run dev
```

### Environment Variables

Configure the following keys in your `.env` file:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
GITHUB_APP_ID="your_github_app_id"
GITHUB_APP_CLIENT_ID="your_github_app_client_id"
GITHUB_APP_CLIENT_SECRET="your_github_app_client_secret"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET="your_webhook_secret"
GOOGLE_AI_API_KEY="..."
QDRANT_URL="..."
QDRANT_API_KEY="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="..."
ENCRYPTION_KEY="..."
```

## Project Structure

```text
src/
├── app/
│   ├── api/webhooks/      # High-scale webhook ingestion logic
│   ├── dashboard/         # SSR-heavy analytics and management UI
├── lib/
│   ├── services/          
│   │   ├── github.ts      # Octokit wrappers for PR manipulation
│   │   ├── reviewer.ts    # Core RAG reasoning & review logic
│   │   ├── indexer.ts     # AST-based code chunking & embedding
│   └── queue.ts           # BullMQ job definitions
└── prisma/                # Relational schema for repos, PRs, and users
```

## License

MIT © Revio
