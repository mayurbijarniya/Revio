-- Nice-to-have: Test Coverage Analysis
--
-- Persists heuristic test coverage signals for:
-- - `pr_reviews` (latest)
-- - `pr_review_runs` (historical)

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS test_coverage JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pr_review_runs
  ADD COLUMN IF NOT EXISTS test_coverage JSONB NOT NULL DEFAULT '{}'::jsonb;

