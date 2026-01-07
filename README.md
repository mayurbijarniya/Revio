# Revio

**AI-Powered Code Review Platform**

Revio is an intelligent code review agent that understands your codebase context. Connect your GitHub repositories to get automated PR reviews, natural language code search, and chat-based code assistance.

## Features

- **Contextual PR Reviews** - AI analyzes your entire codebase to provide meaningful, context-aware code reviews
- **Code Chat** - Ask questions about your codebase in natural language
- **Semantic Search** - Find code by describing what it does, not just keywords
- **Security Analysis** - Automatic detection of security vulnerabilities and best practice violations
- **Analytics Dashboard** - Track review metrics, code quality trends, and team activity

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
