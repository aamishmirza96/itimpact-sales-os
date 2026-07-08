-- =====================================================
-- IT Impact CRM — Seed Active Positions
-- Run ONCE in Supabase SQL Editor after supabase-recruiting.sql
-- =====================================================

INSERT INTO public.recruiting_positions (title, type, location, sector, status, summary)
VALUES
  (
    'Director of US Sales',
    'Full Time',
    'Remote, US-based',
    'Sales & Commercial',
    'Active',
    'Physician-Led Virtual Healthcare Company'
  ),
  (
    'AI Engineer',
    'Full Time',
    'Remote — Worldwide',
    'Engineering (R&D)',
    'Active',
    ''
  ),
  (
    'CRM Manager',
    'Full Time',
    'Remote — Global, Any Timezone',
    'Marketing',
    'Active',
    'Venture-Backed Hospitality Tech Company'
  ),
  (
    'Business Development Representative — Health System Partnerships',
    'Full Time',
    'Remote, US-based',
    'Sales & Business Development',
    'Active',
    'Physician-Led Virtual Specialty Care Company'
  ),
  (
    'Computer System Validation (CSV) Consultant — Junior Level',
    'Full Time | Contract',
    'Remote / Hybrid (U.S., GCC, or South Asia)',
    'Quality Assurance / Regulatory Compliance',
    'Active',
    'Pharmaceutical & Biotechnology'
  ),
  (
    'Computer System Validation (CSV) Consultant — Mid-Level',
    'Full Time | Contract',
    'Remote / Hybrid (U.S., GCC, or South Asia)',
    'Quality Assurance / Regulatory Compliance',
    'Active',
    'Pharmaceutical, Biotechnology, Medical Device, CRO/CMO'
  ),
  (
    'Computer System Validation (CSV) Consultant — Senior Level',
    'Full Time | Contract | Advisory',
    'Remote / Hybrid (U.S., GCC, or South Asia)',
    'Quality Assurance / Regulatory Compliance',
    'Active',
    'Pharmaceutical, Biotechnology, Medical Device, CRO/CMO, Regulatory Advisory'
  );
