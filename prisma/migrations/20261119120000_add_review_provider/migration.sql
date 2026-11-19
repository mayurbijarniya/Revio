-- AI provider used for a user's PR reviews: 'google' (Gemini) or 'deepseek' (via Subconscious).
-- Existing users keep Google. Safe to run more than once.
-- Run this BEFORE deploying the code that reads the column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS review_provider VARCHAR(20) NOT NULL DEFAULT 'google';
