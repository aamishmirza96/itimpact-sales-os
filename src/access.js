// Role-based access control (in-app enforcement layer).
// Roles: ceo > admin > member > viewer. CEO/Admin always have full access;
// members/viewers get per-module levels from profiles.permissions (jsonb).
// Note: this gates the UI — database-level RLS is the hard-enforcement
// follow-up (see supabase-rbac.sql).
import { currentProfile } from './auth.js';

export const ROLES = [
  { id: 'ceo',    label: 'CEO',    desc: 'Full access to everything, including granting any role' },
  { id: 'coo',    label: 'COO',    desc: 'Same access as CEO' },
  { id: 'admin',  label: 'Admin',  desc: 'Full access; manages Member/Viewer permissions' },
  { id: 'member', label: 'Member', desc: 'Access per page, set by leadership' },
  { id: 'viewer', label: 'Viewer', desc: 'Read-only access per page' },
];

// CEO and COO are the equal top tier
const OWNER_ROLES = ['ceo', 'coo'];

export const MODULES = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'sales',      label: 'Sales' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'projects',   label: 'Projects & Tasks' },
  { id: 'content',    label: 'Content' },
  { id: 'inbox',      label: 'Inbox' },
  { id: 'reports',    label: 'Reports' },
  { id: 'team',       label: 'Team & Access' },
];

export const LEVELS = [
  { id: 'none', label: 'Hidden' },
  { id: 'view', label: 'View only' },
  { id: 'edit', label: 'Can edit' },
  { id: 'full', label: 'Full control' },
];

// 'comment' sits between view and edit (can see + comment, can't edit data)
const ORDER = { none: 0, view: 1, comment: 1, edit: 2, full: 3 };

// Dev-only: lets tests simulate a profile from the console
if (import.meta.env.DEV) window.__accessOverride = null;

function profile() {
  if (import.meta.env.DEV && window.__accessOverride) return window.__accessOverride;
  return currentProfile;
}

export function roleOf(p = profile()) { return p?.role || 'member'; }

// CEO/COO + Admin can manage other people's access
export function isElevated(p = profile()) { return [...OWNER_ROLES, 'admin'].includes(roleOf(p)); }
export function isCeo(p = profile()) { return OWNER_ROLES.includes(roleOf(p)); }

// Which roles can this manager assign to others?
export function assignableRoles(p = profile()) {
  if (isCeo(p)) return ROLES;                                  // CEO/COO grant anything
  if (roleOf(p) === 'admin') return ROLES.filter(r => ['member', 'viewer'].includes(r.id));
  return [];
}

// Can this manager edit the target member's access at all?
export function canManageMember(target, p = profile()) {
  if (!target || target.id === p?.id) return false;            // never your own
  if (isCeo(p)) return true;
  if (roleOf(p) === 'admin') return ![...OWNER_ROLES, 'admin'].includes(target.role);
  return false;
}

export function accessLevel(moduleId, p = profile()) {
  // Local mode / no profile loaded yet → don't lock the app
  if (!p) return 'full';
  if (isElevated(p)) return 'full';
  const lvl = p.permissions?.[moduleId];
  if (lvl && ORDER[lvl] !== undefined) return lvl;
  // Defaults when a module was never configured: members keep today's
  // behavior (edit), viewers are read-only.
  return p.role === 'viewer' ? 'view' : 'edit';
}

export function can(moduleId, action = 'view', p = profile()) {
  return ORDER[accessLevel(moduleId, p)] >= (ORDER[action] ?? 1);
}
