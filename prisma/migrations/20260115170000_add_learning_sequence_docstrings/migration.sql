-- Phase 4: Learning & Memory + Sequence Diagrams + Docstring Suggestions
--
-- This migration adds:
-- - `review_learning` table for repository/org-level learned preferences
-- - `pr_review_runs` table to track historical review runs for adoption tracking
-- - New columns on `pr_reviews` for sequence diagrams, docstring suggestions, and run metadata
--
-- NOTE: RLS is enabled for all tables in this database as defense-in-depth.
-- This migration enables RLS on the newly added tables as well.

-- -------------------------
-- pr_reviews new columns
-- -------------------------
ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS docstring_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS head_sha VARCHAR(40);

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS run_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS sequence_diagram TEXT;

-- Prisma uses @updatedAt at the application layer; we still add a DB default to backfill existing rows safely.
ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- -------------------------
-- review_learning table
-- -------------------------
CREATE TABLE IF NOT EXISTS public.review_learning (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  repository_id UUID,
  organization_id UUID,
  preferred_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  suppressed_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_rule_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  adoption_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT review_learning_pkey PRIMARY KEY (id),
  CONSTRAINT review_learning_repository_id_key UNIQUE (repository_id),
  CONSTRAINT review_learning_organization_id_key UNIQUE (organization_id),
  CONSTRAINT review_learning_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT review_learning_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS review_learning_repository_id_idx ON public.review_learning(repository_id);
CREATE INDEX IF NOT EXISTS review_learning_organization_id_idx ON public.review_learning(organization_id);

ALTER TABLE public.review_learning ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- pr_review_runs table
-- -------------------------
CREATE TABLE IF NOT EXISTS public.pr_review_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pr_review_id UUID NOT NULL,
  run_number INTEGER NOT NULL,
  head_sha VARCHAR(40),
  summary TEXT,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  files_analyzed JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation VARCHAR(20),
  risk_level VARCHAR(20),
  confidence_score SMALLINT,
  sequence_diagram TEXT,
  docstring_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  processing_time_ms INTEGER,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pr_review_runs_pkey PRIMARY KEY (id),
  CONSTRAINT pr_review_runs_pr_review_id_fkey FOREIGN KEY (pr_review_id) REFERENCES public.pr_reviews(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT pr_review_runs_pr_review_id_run_number_key UNIQUE (pr_review_id, run_number)
);

CREATE INDEX IF NOT EXISTS pr_review_runs_pr_review_id_idx ON public.pr_review_runs(pr_review_id);

ALTER TABLE public.pr_review_runs ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- Additional performance indexes
-- -------------------------
CREATE INDEX IF NOT EXISTS pr_reviews_updated_at_idx ON public.pr_reviews(updated_at);
