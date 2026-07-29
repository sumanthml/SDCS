-- ============================================================
-- Intelligent Smart Manufacturing Job Scheduling Simulator
-- Supabase PostgreSQL Schema
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE (extends Supabase auth.users via trigger)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Planner' CHECK (role IN ('Planner', 'Manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MACHINES TABLE
CREATE TABLE IF NOT EXISTS public.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    machine_code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Offline')),
    shift_hours FLOAT DEFAULT 8.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_machine_code_per_user UNIQUE(user_id, machine_code)
);

-- 3. JOBS TABLE
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    job_name VARCHAR(100) NOT NULL,
    priority INT DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    arrival_time FLOAT DEFAULT 0.0,
    due_date FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. JOB OPERATIONS TABLE
CREATE TABLE IF NOT EXISTS public.job_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
    step_number INT NOT NULL,
    duration_mins FLOAT NOT NULL CHECK (duration_mins > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_job_step UNIQUE(job_id, step_number)
);

-- 5. SIMULATION RUNS TABLE
CREATE TABLE IF NOT EXISTS public.simulation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    run_name VARCHAR(100),
    algorithm_used VARCHAR(50) NOT NULL CHECK (algorithm_used IN ('FCFS', 'SPT', 'Priority', 'CP-SAT')),
    makespan FLOAT NOT NULL,
    avg_flow_time FLOAT NOT NULL,
    total_idle_time FLOAT DEFAULT 0,
    machine_utilization JSONB NOT NULL DEFAULT '{}',
    schedule_logs JSONB NOT NULL DEFAULT '[]',
    bottleneck_machine_id VARCHAR(100),
    disruptions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

-- Users: can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Machines: users manage their own machines
CREATE POLICY "Users manage own machines" ON public.machines
    FOR ALL USING (auth.uid() = user_id);

-- Jobs: users manage their own jobs
CREATE POLICY "Users manage own jobs" ON public.jobs
    FOR ALL USING (auth.uid() = user_id);

-- Job Operations: accessible if the parent job belongs to the user
CREATE POLICY "Users manage own job operations" ON public.job_operations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = job_operations.job_id
            AND jobs.user_id = auth.uid()
        )
    );

-- Simulation Runs: users see their own runs
CREATE POLICY "Users manage own simulation runs" ON public.simulation_runs
    FOR ALL USING (auth.uid() = user_id);

-- Managers can view all simulation runs (role-based)
CREATE POLICY "Managers view all simulation runs" ON public.simulation_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'Manager'
        )
    );

-- ============================================================
-- Auto-create user profile on sign-up trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'Planner')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_machines_user_id ON public.machines(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_job_operations_job_id ON public.job_operations(job_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_user_id ON public.simulation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_created_at ON public.simulation_runs(created_at DESC);
