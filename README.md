<p align="center">
  <img src="public/logo.svg" alt="Revio Logo" width="120" height="auto" />
</p>

# Revio

An AI-powered code review platform that provides context-aware analysis for modern engineering teams.

## Overview

Revio is a context-aware code review agent designed to enhance code quality and accelerate development workflows. It leverages semantic codebase intelligence to provide comprehensive code analysis, security scanning, and automated feedback on pull requests.

## Problem Statement

Code review processes often create bottlenecks in software development. Manual reviews can result in:
- Critical bugs overlooked due to reviewer fatigue
- Inconsistent quality standards across different reviewers
- Delayed shipping cycles as code awaits feedback
- Accumulated technical debt from changes that break architectural patterns

Revio addresses these challenges by providing automated, consistent code review with complete repository context.

## Technical Architecture

Revio operates as a modular, event-driven system using a Retrieval-Augmented Generation (RAG) pipeline:

```mermaid
graph TD
    A[GitHub Event: Push/PR] --> B[Webhook Ingestion]
    B --> C{Context Construction}
    C --> D[Identify Changed Files]
    C --> E[Extract Semantic Anchors]
    D & E --> F[Qdrant Vector Search]
    F --> G[Retrieve Related Code Chunks]
    G --> H[Code Graph Analysis]
    H --> I[AI Reasoning]
    I --> J[Review Generation]
    J --> K[GitHub Reflection: Inline Comments]
    K --> L[Database Sync]
```

### Core Components

1. **Ingestion Engine**: Extracts code from GitHub, chunks it using AST-aware parsing, and generates vector embeddings.
2. **Code Graph Engine**: Builds AST-based code understanding with function relationships and dependency mapping.
3. **Vector Store (Qdrant)**: Stores high-dimensional code representations for fast similarity searches.
4. **Review Orchestrator**: Triggered by GitHub webhooks to perform context retrieval, build code graphs, and execute reasoning loops.
5. **Feedback System**: Posts results as GitHub inline comments or summary reviews.

## Key Features

### Autonomous Code Review
Revio analyzes code beyond syntax by understanding architectural intent. It indexes entire codebases to identify violations of design patterns, logic duplication, and subtle regressions that standard linters miss.

### Security Analysis
Equipped with pattern recognition for detecting:
- Injection vulnerabilities (SQL, NoSQL, Command Injection)
- Data exposure risks (XSS, hardcoded secrets, PII leakage)
- Weak cryptography (obsolete hashing algorithms, insecure random generation)
- Configuration issues (insecure CORS policies, debug mode exposure)

### AI Code Intelligence
- **Graph-Based Analysis**: AST-powered code understanding with function relationships and call paths
- **Confidence Scoring**: Merge readiness assessment based on issues, security, and complexity analysis
- **Impact Analysis**: Visual representation of affected files and functions
- **Adaptive Learning**: System learns from team feedback to reduce false positives
- **Interactive Bot**: Conversational interface via PR comments for clarifications and re-reviews
- **Documentation Suggestions**: AI-generated JSDoc recommendations

### Team Analytics
- Monitor review turnaround times and throughput across repositories
- Identify code quality hotspots and recurring technical debt patterns
- Real-time activity feed for repository events and review findings

## Technology Stack

- **Frontend/API**: Next.js 15 (App Router, Server Actions)
- **Runtime**: Node.js 24.x
- **Database**: PostgreSQL (Prisma ORM)
- **Vector Intelligence**: Qdrant
- **Message Queue**: BullMQ (Redis)
- **AI Models**: Support for leading Large Language Models (LLMs) and embeddings model
- **Authentication**: GitHub App Architecture (Octokit)

## Security and Privacy

Revio implements enterprise-grade security measures:

- **Data Encryption**: Access tokens and sensitive configurations encrypted at rest using AES-256-GCM
- **Stateless Processing**: Code diffs processed in temporary contexts without long-term storage
- **Isolated Vector Index**: Each repository maintains an isolated namespace in the vector database
- **Row Level Security**: Database tables protected with RLS to prevent unauthorized access

## Review Workflow

When a pull request is detected, Revio executes the following sequence:

1. **Context Construction**: Identifies changed files and extracts semantic anchors
2. **Code Graph Analysis**: Builds AST-based graph of function relationships and dependencies
3. **Semantic Retrieval**: Queries vector store for relevant code snippets across the repository
4. **Impact Analysis**: Calculates affected functions and files
5. **Prompt Orchestration**: Constructs multi-turn prompt with PR diff, context, and review rules
6. **AI Inference**: Processes orchestrated prompt using specialized AI models
7. **Review Generation**: Generates structured review with confidence scores and suggestions
8. **GitHub Integration**: Maps feedback to specific line numbers in the PR

## Getting Started

### Prerequisites

- Node.js 24.x (run `nvm use` if you use nvm; `.nvmrc` is included)
- PostgreSQL database (local or cloud-hosted)
- Redis instance (required for BullMQ)
- Qdrant (Docker instance or Qdrant Cloud)

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
SESSION_SECRET="..."
ENCRYPTION_KEY="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GITHUB_APP_ID="your_github_app_id"
GITHUB_APP_CLIENT_ID="your_github_app_client_id"
GITHUB_APP_CLIENT_SECRET="your_github_app_client_secret"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET="your_webhook_secret"
GOOGLE_AI_API_KEY="..."
OPENAI_API_KEY="..."
QDRANT_URL="..."
QDRANT_API_KEY="..."
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
CRON_SECRET="..."
BACKGROUND_MODE="hybrid"
```

`BACKGROUND_MODE` options:
- `hybrid` (recommended): queue-first with serverless fallback
- `queue`: queue-only (requires always-on workers)
- `serverless`: fallback execution only

## Scaling and Performance

Revio is designed for horizontal scalability:

- **Background Workers**: BullMQ and Redis manage indexing and review jobs asynchronously
- **Serverless Optimization**: Utilizes Next.js `after()` API as fallback for long-running tasks
- **Vector Performance**: Qdrant's HNSW indexing ensures fast context retrieval for large codebases

### Worker Runtime

Run queue workers in a separate always-on service:

```bash
npm run worker
```

Or run dedicated workers:

```bash
npm run worker:indexing
npm run worker:review
```

Deployment guide: `docs/worker-deployment.md`

Health endpoints:
- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/health/deps`

## Reliability Testing

```bash
npm run test
```

## Production Deployment

1. Configure production environment variables (`DATABASE_URL`, Redis/Qdrant credentials, AI API keys, `NEXT_PUBLIC_APP_URL`)
2. Run database migrations: `npx prisma migrate deploy --schema prisma/schema.prisma`
3. Create GitHub App with required permissions:
   - Repository permissions: pull_requests, issue_comments, contents
   - Webhook URL: `https://your-domain.com/api/webhooks/github`
4. Configure `GITHUB_APP_WEBHOOK_SECRET` in environment
5. Test by opening a PR and verifying review posting, then test bot interaction with `@revio-bot explain`

## Roadmap

- Enhanced context retrieval for massive monorepos
- Auto-fix integration with one-click PR updates
- IDE integration (VS Code extension, JetBrains plugin)

## Contributing

Contributions are welcome. Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
