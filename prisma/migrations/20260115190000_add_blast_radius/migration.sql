-- Phase 4: Blast Radius Visualization
--
-- Adds a persisted blast radius payload (JSONB) to:
-- - `pr_reviews` (latest run view)
-- - `pr_review_runs` (historical run tracking)

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS blast_radius JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pr_review_runs
  ADD COLUMN IF NOT EXISTS blast_radius JSONB NOT NULL DEFAULT '{}'::jsonb;

