-- DevRank Supabase Schema — Run this ENTIRE script in Supabase SQL Editor
-- Project: qzotpqktoljhjaybqwqz

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Candidates Table (unified — no fake sample data)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
    github_username   TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT,
    target_role       TEXT DEFAULT 'Software Engineer',
    bio               TEXT DEFAULT '',
    linkedin_url      TEXT DEFAULT '',
    leetcode_username TEXT DEFAULT '',
    avatar            TEXT,
    -- XP breakdown
    total_xp          INT DEFAULT 0,
    github_xp         INT DEFAULT 0,
    leetcode_xp       INT DEFAULT 0,
    resume_xp         INT DEFAULT 0,
    interview_xp      INT DEFAULT 0,
    challenge_xp      INT DEFAULT 0,
    -- Live stats (JSONB)
    github_stats      JSONB DEFAULT '{}',
    leetcode_stats    JSONB DEFAULT '{}',
    skills            JSONB DEFAULT '[]',
    badges            JSONB DEFAULT '[]',
    applied_jobs      JSONB DEFAULT '[]',
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security) but allow all reads/writes for now
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public candidates read" ON candidates FOR SELECT USING (true);
CREATE POLICY "Public candidates write" ON candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public candidates update" ON candidates FOR UPDATE USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Job Drops Table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_drops (
    id              TEXT PRIMARY KEY,
    company_name    TEXT NOT NULL,
    logo            TEXT DEFAULT '🚀',
    title           TEXT NOT NULL,
    location        TEXT DEFAULT 'Remote',
    salary          TEXT DEFAULT 'Competitive',
    req_xp          INT DEFAULT 100,
    req_leetcode    INT DEFAULT 0,
    req_github_repos INT DEFAULT 0,
    skills          JSONB DEFAULT '[]',
    applicants_count INT DEFAULT 0,
    status          TEXT DEFAULT 'active',
    recruiter_email TEXT,
    recruiter_name  TEXT,
    company_name_hr TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public job_drops read" ON job_drops FOR SELECT USING (true);
CREATE POLICY "Public job_drops write" ON job_drops FOR INSERT WITH CHECK (true);
CREATE POLICY "Public job_drops update" ON job_drops FOR UPDATE USING (true);
CREATE POLICY "Public job_drops delete" ON job_drops FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Admin Challenges Table (admin creates, students complete)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    difficulty          TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
    time_limit_seconds  INT DEFAULT 300,
    xp_reward           INT DEFAULT 5,
    tags                TEXT[] DEFAULT '{}',
    is_active           BOOLEAN DEFAULT true,
    created_by_email    TEXT DEFAULT 'admin@devrank.io',
    created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public challenges read" ON challenges FOR SELECT USING (true);
CREATE POLICY "Admin challenges write" ON challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin challenges update" ON challenges FOR UPDATE USING (true);
CREATE POLICY "Admin challenges delete" ON challenges FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Challenge Submissions Table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_submissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id        UUID REFERENCES challenges(id) ON DELETE CASCADE,
    github_username     TEXT NOT NULL,
    answer              TEXT,
    time_taken_seconds  INT,
    xp_earned           INT DEFAULT 0,
    submitted_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE challenge_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public submissions read" ON challenge_submissions FOR SELECT USING (true);
CREATE POLICY "Public submissions write" ON challenge_submissions FOR INSERT WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Realtime publication (enable realtime for all tables)
-- ──────────────────────────────────────────────────────────────────────────────
-- Run in Supabase: Realtime -> Tables -> enable candidates, job_drops, challenges

-- Remove old fake sample data if schema.sql was run before
DELETE FROM users WHERE email LIKE '%@devrank.io' OR email = 'recruiter@techcorp.com';

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Add AI columns to candidates (safe — IF NOT EXISTS)
-- Run this in Supabase SQL editor if you already ran schema.sql before
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS extracted_profile  JSONB DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skill_scores       JSONB DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ats_score          INT   DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contributions_data JSONB DEFAULT '{}';

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Disable RLS or Grant DELETE permissions for Candidates
-- Run this in Supabase SQL Editor so DELETE FROM candidates works!
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
GRANT ALL ON candidates TO anon, authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Real-World 1v1 Battle Matches Table & Admin Approval Queue
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battle_matches (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_username  TEXT NOT NULL,
    opponent_username    TEXT NOT NULL,
    title                TEXT DEFAULT '1v1 Developer Battle Match',
    problem_statement    TEXT DEFAULT '',
    starter_code         TEXT DEFAULT '',
    status               TEXT DEFAULT 'pending_admin_approval',
    winner_username      TEXT,
    created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE battle_matches DISABLE ROW LEVEL SECURITY;
GRANT ALL ON battle_matches TO anon, authenticated, service_role;


-- To completely wipe all test profiles right now, run in Supabase SQL Editor:
-- TRUNCATE TABLE candidates CASCADE;

