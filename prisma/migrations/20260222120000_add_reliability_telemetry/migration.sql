-- Reliability telemetry for indexing and PR review queue orchestration.

ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS index_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS index_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS index_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS index_job_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS repositories_index_status_index_queued_at_idx
  ON public.repositories (index_status, index_queued_at);

CREATE INDEX IF NOT EXISTS repositories_index_status_index_heartbeat_at_idx
  ON public.repositories (index_status, index_heartbeat_at);

ALTER TABLE public.pr_reviews
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS pr_reviews_status_queued_at_idx
  ON public.pr_reviews (status, queued_at);
