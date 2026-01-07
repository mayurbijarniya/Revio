# Revio

**AI-Powered Code Review Platform**

Revio is an intelligent code review agent that understands your codebase context. Connect your GitHub repositories to get automated PR reviews, natural language code search, and chat-based code assistance.

## Features

- **Contextual PR Reviews** - AI analyzes your entire codebase to provide meaningful, context-aware code reviews
- **Code Chat** - Ask questions about your codebase in natural language
- **Semantic Search** - Find code by describing what it does, not just keywords
- **Security Analysis** - Automatic detection of security vulnerabilities and best practice violations
- **Analytics Dashboard** - Track review metrics, code quality trends, and team activity

## How It Works

Revio transforms the traditional code review process by leveraging advanced AI models combined with deep codebase understanding. When you connect a repository, Revio indexes your entire codebase using semantic embeddings, creating a searchable knowledge graph of your code structure, patterns, and relationships. This isn't just keyword matching - Revio understands the intent and purpose behind your code.

When a pull request is opened, Revio's AI agent retrieves relevant context from your indexed codebase, including related functions, similar patterns, and architectural conventions your team follows. This context-aware approach means reviews aren't generic suggestions from an AI that doesn't understand your project - they're specific, actionable insights that respect your codebase's unique style and requirements.

The review process analyzes multiple dimensions: code correctness, security vulnerabilities, performance implications, maintainability concerns, and adherence to your team's established patterns. Each issue is categorized by severity (critical, warning, or suggestion) and includes concrete recommendations for improvement. For security issues, Revio provides detailed explanations of the vulnerability, potential attack vectors, and remediation steps.

Beyond PR reviews, the Code Chat feature lets you have natural conversations about your codebase. Ask questions like "How does authentication work in this project?" or "Show me all the places where we handle payment processing" and get accurate, contextual answers backed by your actual code. This is especially valuable for onboarding new team members or when working with unfamiliar parts of a large codebase.

The Analytics Dashboard provides insights into your team's code quality trends over time, tracking metrics like issues per review, common vulnerability categories, and files that frequently require fixes. This data helps identify systemic issues and measure the impact of your code quality initiatives.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **Vector Store**: Qdrant
- **AI**: Google Gemini / OpenAI
- **Styling**: Tailwind CSS
- **ORM**: Prisma

## Getting Started

### Prerequisites

- Node.js >= 20.11.0
- PostgreSQL database (Supabase recommended)
- Qdrant instance for vector storage
- GitHub OAuth App credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/mayurbijarniya/Revio.git
cd Revio

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GOOGLE_AI_API_KEY="..."
QDRANT_URL="..."
QDRANT_API_KEY="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="..."
ENCRYPTION_KEY="..."
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (marketing)/        # Public marketing pages
│   ├── api/                # API routes
│   ├── dashboard/          # Protected dashboard pages
│   └── login/              # Authentication
├── components/             # Reusable UI components
├── lib/                    # Utilities and services
│   ├── services/           # Business logic (GitHub, AI, etc.)
│   └── prompts/            # AI prompt templates
└── types/                  # TypeScript type definitions
```

## License

MIT © Mayur Bijarniya
