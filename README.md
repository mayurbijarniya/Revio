# Revio: Context-Aware AI Code Reviewer

Engineering high-quality code through semantic codebase intelligence.

Revio is a high-performance, context-aware code review agent built for modern engineering teams. It bridges the gap between rapid software delivery and maintainable code quality by leveraging advanced artificial intelligence that understands not just the code, but the context in which it lives.

## Vision and Problem Statement

For modern software teams, the code review process is often a significant bottleneck. Developers spend hours manually reviewing changes, leading to:

1.  Reviewer Fatigue: Critical bugs being missed due to high cognitive load.
2.  Inconsistent Quality: Different reviewers applying different standards.
3.  Slow Shipping Cycles: Code sitting in pull requests for days waiting for feedback.
4.  Technical Debt Accumulation: Incremental changes that break global architectural patterns because the reviewer lacks context of the entire codebase.

Revio solves these challenges by acting as a 24/7 intelligent reviewer that has perfect memory of your entire repository.

## Business Value and Impact

By integrating Revio into your development workflow, organizations achieve:

1.  Faster Time-to-Market: Instant initial feedback on pull requests reduces the cycle time from code completion to merge.
2.  Enhanced Code Quality: Consistent application of best practices and architectural standards across the entire team.
3.  Reduced Engineering Costs: Senior developers are freed from repetitive linting-style reviews to focus on high-level system design.
4.  Improved Onboarding: Intelligent code search and chat help new developers understand complex systems instantly.

## Key Technical Features

Revio implements a Retrieval-Augmented Generation (RAG) pipeline to provide reviews that understand your internal abstractions, design patterns, and architectural invariants.

1.  Semantic Codebase Intelligence: Uses vector embeddings (Qdrant) to index your entire repository, enabling the AI to know your codebase before it reviews a single line of a PR.
2.  Context-Aware PR Analysis: Automatically retrieves relevant cross-file context (shared types, utility functions, usage patterns) to minimize false positives and provide actionable feedback.
3.  Natural Language Code Search: Implements semantic search over code chunks, allowing developers to query the codebase using intent (e.g., "Where do we handle cross-origin auth?") rather than just keyword matches.
4.  Security and Best Practices: Automated AST-aware scanning combined with LLM reasoning to detect complex logical vulnerabilities and architectural drifts.
5.  Automated Workflow: Native GitHub App integration with event-driven triggers (webhooks) and background job processing (BullMQ/Redis).

## Technical Architecture

Revio is designed as a modular, event-driven system:

1.  Ingestion Engine: Extracts code from GitHub, chunks it using AST-aware dividers, and generates vector embeddings via text-embedding-3-small (or Gemini equivalent).
2.  Vector Store (Qdrant): Stores high-dimensional code representations for sub-millisecond similarity searches.
3.  Review Orchestrator:
    - Triggered by GitHub pull_request webhooks.
    - Performs Context Retrieval: Identifies modified files and fetches semantically related code from the vector store.
    - Reasoning Loop: Feeds the diff + retrieved context into a high-reasoning LLM (Gemini 1.5 Pro / GPT-4o) with a specialized system prompt.
4.  Feedback Loop: Posts results as high-fidelity GitHub inline comments or summary reviews.

## Tech Stack

1.  Frontend/API: Next.js 15 (App Router, Server Actions)
2.  Runtime: Node.js 20+
3.  Database: PostgreSQL (Prisma ORM)
4.  Vector Intelligence: Qdrant
5.  Message Queue: BullMQ (Redis)
6.  AI Models: Google Gemini 1.5 Pro / Flash, OpenAI GPT-4o
7.  Auth and API: Octokit (GitHub App Architecture)

## Review Workflow Sequence

When a pull request is detected, Revio executes the following sequence:

1.  Context Construction: The system identifies changed files and extracts semantic anchors (function signatures, class names, etc.).
2.  Semantic Retrieval: It queries the Qdrant vector store to find the top relevant code snippets across the entire repository that correlate with the proposed changes.
3.  Prompt Orchestration: A multi-turn prompt is constructed including the PR Diff, retrieved semantic context, and repository-specific review rules.
4.  AI Inference: The orchestrated prompt is processed by the configured LLM to generate granular, line-by-line feedback.
5.  GitHub Reflection: Feedback is mapped back to specific line numbers in the PR using a fuzzy-match coordinate system to ensure alignment even if the file has shifted.

## Getting Started

### Prerequisites

1.  Node.js: >= 20.11.0
2.  PostgreSQL: e.g., Supabase or local instance
3.  Redis: Required for BullMQ background workers
4.  Qdrant: Local Docker instance or Qdrant Cloud

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

Configure the following keys in your .env file:

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

## Contributing

We welcome technical contributions focused on:
1.  Improving AST-aware code chunking algorithms.
2.  Refining RAG retrieval precision.
3.  Adding support for new language-specific architectural patterns.

### Local Development Flow
1. Fork and clone the repository.
2. Ensure Redis and PostgreSQL are running locally.
3. Use npm run dev to start the Next.js development server.
4. Run npx prisma studio to inspect local database state.

## Roadmap

1.  Support for multi-repository context (system-of-systems analysis).
2.  Direct IDE integration (VS Code extension / JetBrains plugin).
3.  Custom fine-tuned models for specific architectural styles.
4.  Automated fix generation (Pull Request suggestions).

## License

MIT © Revio
