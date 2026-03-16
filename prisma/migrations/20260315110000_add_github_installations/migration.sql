CREATE TABLE IF NOT EXISTS public.github_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  installation_id INTEGER NOT NULL UNIQUE,
  account_id INTEGER NOT NULL,
  account_login VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  repository_selection VARCHAR(50) NOT NULL,
  suspended_at TIMESTAMP(3),
  uninstalled_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS github_installations_user_id_idx
  ON public.github_installations (user_id);

CREATE INDEX IF NOT EXISTS github_installations_account_id_account_type_idx
  ON public.github_installations (account_id, account_type);

CREATE INDEX IF NOT EXISTS github_installations_user_id_uninstalled_at_suspended_at_idx
  ON public.github_installations (user_id, uninstalled_at, suspended_at);
