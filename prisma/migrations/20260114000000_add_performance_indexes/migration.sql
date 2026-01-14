-- Add performance indexes for frequently queried fields
-- This migration adds strategic indexes to improve query performance across the application

-- Repositories: Index for organization queries and indexedAt for stale repo detection
CREATE INDEX IF NOT EXISTS "repositories_organization_id_idx" ON "repositories"("organization_id");
CREATE INDEX IF NOT EXISTS "repositories_indexed_at_idx" ON "repositories"("indexed_at");
CREATE INDEX IF NOT EXISTS "repositories_created_at_idx" ON "repositories"("created_at");

-- IndexedFiles: Index for repository file lookups
CREATE INDEX IF NOT EXISTS "indexed_files_repository_id_idx" ON "indexed_files"("repository_id");
CREATE INDEX IF NOT EXISTS "indexed_files_indexed_at_idx" ON "indexed_files"("indexed_at");

-- Conversations: Index for repository and pinned conversations
CREATE INDEX IF NOT EXISTS "conversations_repository_id_idx" ON "conversations"("repository_id");
CREATE INDEX IF NOT EXISTS "conversations_is_pinned_idx" ON "conversations"("is_pinned");
CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx" ON "conversations"("updated_at");

-- Messages: Index for createdAt for conversation history sorting
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");

-- PrReviews: Index for status, createdAt, and feedback queries
CREATE INDEX IF NOT EXISTS "pr_reviews_status_idx" ON "pr_reviews"("status");
CREATE INDEX IF NOT EXISTS "pr_reviews_created_at_idx" ON "pr_reviews"("created_at");
CREATE INDEX IF NOT EXISTS "pr_reviews_feedback_idx" ON "pr_reviews"("feedback");
CREATE INDEX IF NOT EXISTS "pr_reviews_requested_by_id_idx" ON "pr_reviews"("requested_by_id");

-- Usage: Index for organization analytics and date range queries
CREATE INDEX IF NOT EXISTS "usage_organization_id_created_at_idx" ON "usage"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "usage_action_type_idx" ON "usage"("action_type");

-- Activities: Index for user activities
CREATE INDEX IF NOT EXISTS "activities_user_id_idx" ON "activities"("user_id");
CREATE INDEX IF NOT EXISTS "activities_repository_id_idx" ON "activities"("repository_id");
CREATE INDEX IF NOT EXISTS "activities_type_idx" ON "activities"("type");

-- OrganizationMembers: Index for user lookups
CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx" ON "organization_members"("user_id");

-- Organizations: Index for owner and slug lookups (slug already has unique index)
CREATE INDEX IF NOT EXISTS "organizations_owner_id_idx" ON "organizations"("owner_id");
CREATE INDEX IF NOT EXISTS "organizations_created_at_idx" ON "organizations"("created_at");

-- Composite indexes for common query patterns

-- Repositories: For dashboard queries filtering by user + status
CREATE INDEX IF NOT EXISTS "repositories_user_id_index_status_idx" ON "repositories"("user_id", "index_status");

-- PrReviews: For analytics queries filtering by repository + status + date
CREATE INDEX IF NOT EXISTS "pr_reviews_repository_id_status_created_at_idx" ON "pr_reviews"("repository_id", "status", "created_at");

-- Conversations: For dashboard queries filtering by user + pinned + updated
CREATE INDEX IF NOT EXISTS "conversations_user_id_is_pinned_updated_at_idx" ON "conversations"("user_id", "is_pinned", "updated_at");

-- Note: These indexes will significantly improve query performance for:
-- 1. Dashboard loading (repositories, conversations, reviews)
-- 2. Analytics queries (usage, activities, reviews over time)
-- 3. Organization pages (members, repositories, activities)
-- 4. Search and filtering operations
-- 5. Stale repository detection for re-indexing cron job
