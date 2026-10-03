-- ====================================================================
-- SRM Spare Part Management System - Supabase PostgreSQL Schema
-- Unithai Shipyard & Engineering (Laem Chabang Port)
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create PROFILES Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'SRM' CHECK (role IN ('ADMIN', 'SRM')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create JOBS Table (Shipyard repair & modification jobs)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no TEXT UNIQUE NOT NULL,
  job_name TEXT NOT NULL,
  vessel TEXT NOT NULL,
  customer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ON_HOLD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create JOB_ASSIGNMENTS Table (Linking SRMs to Jobs)
CREATE TABLE IF NOT EXISTS public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_job_assignment UNIQUE (user_id, job_id)
);

-- 5. Create SHIPMENTS Table (Tracking spare parts & maritime cargo)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  awb_bl TEXT NOT NULL,
  supplier TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'Unithai Shipyard Laem Chabang',
  mode TEXT NOT NULL CHECK (mode IN ('AIR', 'SEA', 'COURIER', 'LAND')),
  eta TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_TRANSIT' CHECK (status IN ('IN_TRANSIT', 'ARRIVING_TODAY', 'RECEIVED', 'DELAYED')),
  received_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Create NOTIFICATIONS Table (Targeted alerts for SRMs)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'STATUS_CHANGE',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_no ON public.jobs(job_no);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON public.job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON public.job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_shipments_job_id ON public.shipments(job_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 8. Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_shipments_updated_at ON public.shipments;
CREATE TRIGGER set_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Automatic Profile Creation on Supabase auth.users Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_id, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Shipyard User'),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', 'UT-' || SUBSTRING(NEW.id::text, 1, 6)),
    'SRM', -- DEFAULT ROLE IS ALWAYS SRM (NO ADMIN BY REGISTRATION)
    'ACTIVE'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Is Current User an ADMIN?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- PROFILES POLICIES
-- --------------------------------------------------------------------
-- Users can view their own profile; Admins can view all profiles
DROP POLICY IF EXISTS "Profiles read policy" ON public.profiles;
CREATE POLICY "Profiles read policy" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- Users can update non-critical info of their own; Admins can update any profile
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  ) WITH CHECK (
    -- SRM cannot escalate their own role
    (public.is_admin()) OR (auth.uid() = id AND role = 'SRM')
  );

-- --------------------------------------------------------------------
-- JOBS POLICIES
-- --------------------------------------------------------------------
-- Admins have full access to jobs
DROP POLICY IF EXISTS "Admin full jobs access" ON public.jobs;
CREATE POLICY "Admin full jobs access" ON public.jobs
  FOR ALL USING (public.is_admin());

-- SRMs can view only jobs assigned to them
DROP POLICY IF EXISTS "SRM assigned jobs view" ON public.jobs;
CREATE POLICY "SRM assigned jobs view" ON public.jobs
  FOR SELECT USING (
    id IN (
      SELECT job_id FROM public.job_assignments
      WHERE user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------
-- JOB_ASSIGNMENTS POLICIES
-- --------------------------------------------------------------------
-- Admins have full access to assignments
DROP POLICY IF EXISTS "Admin full job_assignments access" ON public.job_assignments;
CREATE POLICY "Admin full job_assignments access" ON public.job_assignments
  FOR ALL USING (public.is_admin());

-- SRMs can view their own job assignments
DROP POLICY IF EXISTS "SRM read own job_assignments" ON public.job_assignments;
CREATE POLICY "SRM read own job_assignments" ON public.job_assignments
  FOR SELECT USING (user_id = auth.uid());

-- --------------------------------------------------------------------
-- SHIPMENTS POLICIES
-- --------------------------------------------------------------------
-- Admins have full access to shipments
DROP POLICY IF EXISTS "Admin full shipments access" ON public.shipments;
CREATE POLICY "Admin full shipments access" ON public.shipments
  FOR ALL USING (public.is_admin());

-- SRMs can view shipments belonging to their assigned jobs
DROP POLICY IF EXISTS "SRM view assigned shipments" ON public.shipments;
CREATE POLICY "SRM view assigned shipments" ON public.shipments
  FOR SELECT USING (
    job_id IN (
      SELECT job_id FROM public.job_assignments
      WHERE user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- --------------------------------------------------------------------
-- Users can view their own notifications
DROP POLICY IF EXISTS "User read own notifications" ON public.notifications;
CREATE POLICY "User read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "User update own notifications" ON public.notifications;
CREATE POLICY "User update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- ====================================================================
-- SEED DATA (Unithai Shipyard Realistic Baseline Projects)
-- ====================================================================

INSERT INTO public.jobs (job_no, job_name, vessel, customer, status)
VALUES
  ('26-R-2928', 'GAS LOMBOK - Main Engine Overhaul & Drydocking', 'GAS LOMBOK', 'PT Pertamina International Shipping', 'ACTIVE'),
  ('26-R-2931', 'SEMERU - Propeller Shaft & Stern Tube Survey', 'SEMERU', 'Samudera Indonesia', 'ACTIVE'),
  ('26-R-2930', 'THOR CONFIDENCE - Hull Grit Blasting & Cargo Holds', 'THOR CONFIDENCE', 'Thoresen Shipping', 'ACTIVE'),
  ('26-R-2940', 'WAN HAI 312 - Auxiliary Engine #2 Crankshaft Replacement', 'WAN HAI 312', 'Wan Hai Lines', 'ACTIVE'),
  ('26-R-2945', 'EASTERN OCEAN - Ballast Water Treatment System (BWTS) Retrofit', 'EASTERN OCEAN', 'Eastern Maritime Co.', 'ACTIVE')
ON CONFLICT (job_no) DO NOTHING;
