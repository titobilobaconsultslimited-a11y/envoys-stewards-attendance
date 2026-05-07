-- ════════════════════════════════════════════════════════════════
-- Envoys Stewards Attendance — Database Setup (Neon / PostgreSQL)
-- Run this entire script in:
--   Neon Dashboard → SQL Editor → paste → Run
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- TABLE 1: staff
-- Stores registered staff members and their WebAuthn credentials.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  staff_id       text        UNIQUE NOT NULL,
  credential_id  text        UNIQUE,          -- WebAuthn credential ID (base64url)
  public_key     text,                        -- WebAuthn attestation object (base64)
  registered_at  timestamptz DEFAULT now()
);

-- Index for fast look-up by staff_id (used on every attendance action)
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON public.staff (staff_id);


-- ────────────────────────────────────────────────────────────────
-- TABLE 2: attendance
-- Stores every check-in / check-out event.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    text        NOT NULL REFERENCES public.staff (staff_id) ON DELETE CASCADE,
  staff_name  text        NOT NULL,
  action      text        NOT NULL CHECK (action IN ('check-in', 'check-out')),
  timestamp   timestamptz DEFAULT now(),
  date        date        DEFAULT CURRENT_DATE
);

-- Index for fast look-up by date (used in admin dashboard)
CREATE INDEX IF NOT EXISTS idx_attendance_date     ON public.attendance (date);
-- Index for look-up by staff (used in filtered admin view)
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON public.attendance (staff_id);


-- ════════════════════════════════════════════════════════════════
-- DONE — Both tables are ready.
--
-- Access control is handled at the Vercel Function layer.
-- The database connection string (DATABASE_URL) is stored as a
-- Vercel Environment Variable and never exposed to the browser.
-- ════════════════════════════════════════════════════════════════
