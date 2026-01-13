-- Enable Row Level Security (RLS) on all tables
-- This adds defense-in-depth security without breaking Prisma
-- RLS is bypassed by service_role key which Prisma uses

-- Users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Repositories
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexed_files ENABLE ROW LEVEL SECURITY;

-- Chat
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Reviews
ALTER TABLE public.pr_reviews ENABLE ROW LEVEL SECURITY;

-- Billing & Analytics
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Note: No RLS policies are defined, which blocks all direct PostgREST API access
-- Prisma uses service_role key which bypasses RLS, so the application works normally
-- This provides defense-in-depth security against unauthorized direct database access

