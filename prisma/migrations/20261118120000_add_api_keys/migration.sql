-- Personal API keys for the Revio MCP server.
-- Safe to run more than once: every statement checks whether the object already exists.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  last_used_at TIMESTAMP(3),
  revoked_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_key
  ON public.api_keys (key_hash);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx
  ON public.api_keys (user_id);

-- Same policy as every other table: RLS on, the app's service role bypasses it
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
