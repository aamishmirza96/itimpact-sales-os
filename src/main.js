// Shell / router for Sales OS.
// After the HubSpot-style restructure this file only owns: the 7-item sidebar,
// the top header bar, the per-page tab bar, URL (hash) routing, auth screen,
// per-view data loading and boot. All page views live in src/pages/*.
import {
  app, state, prospects, candidates, addedFromSearch,
  showToast, checkBackend, escHtml, attachCopyButtons,
} from './app-core.js';
import { positions, fetchDbPositions, fetchDbCandidates } from './recruiting.js';
import { supabase, DB_ENABLED, loadDbState } from './supabase.js';
import { initAuth, currentUser, currentProfile, signIn, signUp, signOut } from './auth.js';
import { fetchLeads } from './leads.js';
import { fetchTeamMembers as fetchTeam } from './team.js';
import { fetchArticles } from './articles.js';
import { fetchSocialPosts } from './social-planner.js';
import { fetchTasks } from './tasks.js';
import { fetchNotifications, getUnreadCount, subscribeToNotifications } from './notifications.js';
import { fetchAnalyticsOverview, fetchLiveVisitors } from './analytics.js';
import { buildGraph } from './relationship-map.js';
import { fetchProjects } from './projects.js';
import {
  fetchContactSubmissions, fetchGeneralCVs, fetchJobApplications, fetchAIAssessments,
} from './submissions.js';

import { can, accessLevel } from './access.js';
import { renderHome, renderTeam, attachTeamEvents, renderAccessModal, attachAccessModalEvents } from './pages/dashboard.js';
import {
  renderPipeline, renderLeads, renderICP, renderDisqualify, renderOutreach,
  renderModal, renderLeadModal, renderLeadPanel,
  attachSalesEvents, attachLeadEvents, attachLeadModalEvents, attachLeadPanelEvents,
} from './pages/sales.js';
import {
  renderRecruiting, renderGeneralCVs, renderJobApplications, renderAIAssessments,
  renderFilesView, attachRecruitingEvents, renderCandidatePanel, attachCandidatePanelEvents,
} from './pages/recruiting.js';
import { attachSubmissionEvents } from './pages/submissions-shared.js';
import {
  renderProjects, renderTasksView, renderTaskModal,
  attachProjectEvents, attachTaskEvents, attachTaskModalEvents, openProject,
} from './pages/projects-tasks.js';
import {
  renderSocialPlanner, renderSocialPostModal, renderArticlesView, renderArticleModal,
  renderSocial, attachSocialPlannerEvents, attachSocialPostModalEvents,
  attachArticleEvents, attachArticleModalEvents, attachContentEngineEvents,
} from './pages/content.js';
import {
  renderContactSubmissions, renderNotifPanel, attachNotifEvents,
  renderNotificationsView, attachNotificationsViewEvents,
} from './pages/inbox.js';
import {
  renderAnalyticsView, renderAgentsView, renderMapView, renderApiKeyModal,
  attachAnalyticsEvents, attachAgentEvents, attachMapEvents, attachApiKeyModalEvents,
  fetchGAData,
} from './pages/reports.js';
import { renderJobBoard, renderJobDetailPanel, attachJobBoardEvents } from './pages/job-board.js';

// ── Nav structure ─────────────────────────────────────────────────────
// Clean inline SVG icons (stroke inherits currentColor).
const ic = (paths) => `<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICONS = {
  dashboard: ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  sales:     ic('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  recruiting:ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M16 14.7c2.6.3 4.6 1.8 5.5 4.3"/>'),
  projects:  ic('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M7 12l3 3 6-6"/>'),
  content:   ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
  inbox:     ic('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l3.5-7z"/>'),
  reports:   ic('<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="0.5"/><rect x="12" y="8" width="3" height="10" rx="0.5"/><rect x="17" y="5" width="3" height="13" rx="0.5"/>'),
  jobboard:  ic('<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>'),
  aireadiness: ic('<path d="M12 2a5 5 0 015 5c0 2.4-1.7 4.4-4 4.9V13h2a1 1 0 010 2h-2v1h2a1 1 0 010 2h-2v2a1 1 0 01-2 0v-2H9a1 1 0 010-2h2v-1H9a1 1 0 010-2h2v-1.1A5 5 0 017 7a5 5 0 015-5z"/>'),
};

// 7 top-level pages; every old sidebar view is a tab inside one of them.
// `key` is the slug used in the URL hash; `set` runs extra state changes
// (e.g. the Recruiting page maps three tabs onto the same underlying view).
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, tabs: [
    { key: 'overview', view: 'home', label: 'Overview' },
    // Team relocated from its own top-level nav item — see pages/dashboard.js
    // (has its own access module so Team & Access can be hidden per member)
    { key: 'team', view: 'team', label: 'Team', module: 'team', count: () => state.team.length },
  ]},
  { id: 'sales', label: 'Sales', icon: ICONS.sales, tabs: [
    { key: 'apollo', view: 'pipeline', label: 'Sales through Apollo', count: () => prospects.length },
    { key: 'leads', view: 'leads', label: 'Leads', count: () => state.leads.length },
    { key: 'outreach', view: 'outreach', label: 'Outreach' },
    { key: 'icp', view: 'icp', label: 'ICP & Triggers' },
    { key: 'disqualified', view: 'disqualify', label: 'Disqualified' },
  ]},
  { id: 'recruiting', label: 'Recruiting', icon: ICONS.recruiting, tabs: [
    { key: 'positions', view: 'recruiting', label: 'Positions', match: () => state.recTab === 'positions', set: () => { state.recTab = 'positions'; }, count: () => (state.dbPositions || []).length },
    { key: 'candidates', view: 'recruiting', label: 'Candidates', match: () => state.recTab === 'candidates', set: () => { state.recTab = 'candidates'; }, count: () => candidates.length },
    { key: 'talent-pool', view: 'recruiting', label: 'Talent Pool', match: () => state.recTab === 'pool', set: () => { state.recTab = 'pool'; } },
    { key: 'job-apps', view: 'job-apps', label: 'Job Applications', count: () => state.jobApplications.length },
    { key: 'general-cvs', view: 'general-cvs', label: 'General CVs', count: () => state.generalCVs.length },
    { key: 'files', view: 'files', label: 'Files' },
  ]},
  { id: 'projects', label: 'Projects & Tasks', icon: ICONS.projects, tabs: [
    { key: 'projects', view: 'projects', label: 'Projects', count: () => state.projects.length },
    { key: 'tasks', view: 'tasks', label: 'Tasks', count: () => state.tasks.length },
  ]},
  { id: 'content', label: 'Content', icon: ICONS.content, tabs: [
    { key: 'planner', view: 'social-planner', label: 'Planner', count: () => state.socialPosts.length },
    { key: 'articles', view: 'articles', label: 'Articles', count: () => state.articles.length },
    { key: 'engine', view: 'social', label: 'Content Engine' },
  ]},
  { id: 'inbox', label: 'Inbox', icon: ICONS.inbox, tabs: [
    { key: 'contact', view: 'contact-subs', label: 'Contact Submissions', count: () => state.contactSubmissions.length },
    { key: 'notifications', view: 'notifications', label: 'Notifications', count: () => state.unreadCount || null },
  ]},
  { id: 'reports', label: 'Reports', icon: ICONS.reports, tabs: [
    { key: 'analytics', view: 'analytics', label: 'Analytics' },
    { key: 'map', view: 'map', label: 'Relationship Map' },
    { key: 'agents', view: 'agents', label: 'AI Agents' },
  ]},
  { id: 'aireadiness', label: 'AI Readiness', icon: ICONS.aireadiness, tabs: [
    { key: 'assessments', view: 'ai-assessments', label: 'AI Assessments', count: () => state.aiAssessments?.length || null },
  ]},
  { id: 'jobboard', label: 'Job Board', icon: ICONS.jobboard, tabs: [
    { key: 'openings', view: 'job-board', label: 'Current Openings', count: () => (state.dbPositions || []).filter(p => p.status === 'Active').length },
  ]},
];

function pageForView(view) {
  return PAGES.find(p => p.tabs.some(t => t.view === view)) || PAGES[0];
}
// Access module for a view: tab-level module if set, else the page id
function moduleForView(view) {
  const page = pageForView(view);
  const tab = page.tabs.find(t => t.view === view);
  return tab?.module || page.id;
}
function activeTab(page) {
  const matches = page.tabs.filter(t => t.view === state.view);
  if (matches.length <= 1) return matches[0] || page.tabs[0];
  return matches.find(t => !t.match || t.match()) || matches[0];
}

// ── URL (hash) routing: #<page>/<tabKey> survives refresh ─────────────
function hashFor(view) {
  const page = pageForView(view);
  const tab = activeTab(page);
  return `#${page.id}/${tab.key}`;
}
function parseHash() {
  const m = location.hash.match(/^#([\w-]+)\/([\w-]+)/);
  if (!m) return null;
  const page = PAGES.find(p => p.id === m[1]);
  const tab = page?.tabs.find(t => t.key === m[2]);
  return tab ? { page, tab } : null;
}
function syncHash() {
  const target = hashFor(state.view);
  if (location.hash !== target) history.replaceState(null, '', target);
}

// ── Per-view data loading (moved verbatim from the old nav handler) ──
async function loadViewData(view) {
  if (view === 'leads') {
    if (state.leads.length === 0) { state.leadsLoading = true; render(); state.leads = await fetchLeads(); state.leadsLoading = false; }
    if (state.team.length === 0) state.team = await fetchTeam();
  }
  if (view === 'projects' && state.projects.length === 0) {
    state.projectsLoading = true; render();
    state.projects = await fetchProjects();
    state.projectsLoading = false;
  }
  if (view === 'team') { state.team = await fetchTeam(); }
  if (view === 'articles' && state.articles.length === 0) { state.articles = await fetchArticles(); }
  if (view === 'social-planner' && state.socialPosts.length === 0) {
    if (state.team.length === 0) state.team = await fetchTeam();
    state.socialPosts = await fetchSocialPosts();
  }
  if (view === 'analytics') {
    state.analyticsData = await fetchAnalyticsOverview(state.analyticsDays);
    if (state.googleConnected) await fetchGAData();
    state.liveVisitors = await fetchLiveVisitors();
    if (state.liveVisitorsInterval) clearInterval(state.liveVisitorsInterval);
    state.liveVisitorsInterval = setInterval(async () => {
      if (state.view !== 'analytics') { clearInterval(state.liveVisitorsInterval); return; }
      state.liveVisitors = await fetchLiveVisitors();
      render();
    }, 10000);
  } else if (state.liveVisitorsInterval) {
    clearInterval(state.liveVisitorsInterval);
    state.liveVisitorsInterval = null;
  }
  if (view === 'agents') {
    state.activeAgent = null; state.agentOutput = ''; state.agentError = null;
  }
  if (view === 'map') {
    if (state.team.length === 0) state.team = await fetchTeam();
    if (state.leads.length === 0) state.leads = await fetchLeads();
    if (state.projects.length === 0) state.projects = await fetchProjects();
    const g = buildGraph({ leads: state.leads, projects: state.projects, team: state.team, positions, candidates });
    state.mapNodes = g.nodes; state.mapEdges = g.edges;
  }
  if (view === 'tasks') state.tasks = await fetchTasks();
  if (view === 'recruiting') {
    const [posRes, candRes] = await Promise.all([fetchDbPositions(), fetchDbCandidates()]);
    state.dbPositions = posRes.rows; state.dbCandidates = candRes.rows;
    state.recruitingDbReady = posRes.tableExists;
  }
  if (view === 'contact-subs') { state.contactSubmissions = await fetchContactSubmissions(); state.tasks = await fetchTasks(); }
  if (view === 'general-cvs') { state.generalCVs = await fetchGeneralCVs(); state.tasks = await fetchTasks(); }
  if (view === 'job-apps') { state.jobApplications = await fetchJobApplications(); state.tasks = await fetchTasks(); }
  if (view === 'ai-assessments') state.aiAssessments = await fetchAIAssessments();
  if (view === 'files') {
    state.generalCVs = await fetchGeneralCVs();
    state.jobApplications = await fetchJobApplications();
  }
  if (view === 'notifications') {
    state.notifications = await fetchNotifications();
    state.unreadCount = await getUnreadCount();
  }
}

async function navigate(view, { set } = {}) {
  // Access gate: members without view rights get bounced to the dashboard
  if (!can(moduleForView(view), 'view')) {
    showToast('You don\'t have access to that area', 'error');
    if (view !== 'home') return navigate('home');
    return;
  }
  if (state.chatUnsub) { state.chatUnsub(); state.chatUnsub = null; }
  state.activeProject = null;
  state.view = view; state.expandedId = null; state.modal = null;
  if (set) set();
  syncHash();
  await loadViewData(view);
  render();
}

// ── Sidebar / top bar / tabs ──────────────────────────────────────────
function renderSidebar() {
  const currentPage = pageForView(state.view);
  const profile = currentProfile;
  return `<aside class="sidebar">
    <div class="sidebar-brand">
      <div class="logo">IT<span>Impact</span></div>
      <div class="sub">Sales OS</div>
    </div>
    <nav class="sidebar-nav">
      ${PAGES.filter(p => can(p.id, 'view')).map(p => `
        <div class="nav-item ${currentPage.id === p.id ? 'active' : ''}" data-page="${p.id}">
          <span class="nav-icon">${p.icon}</span>${p.label}
        </div>`).join('')}
    </nav>
    <div class="sidebar-footer">
      ${profile ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div class="avatar-chip">${(profile.full_name || profile.email || '?')[0].toUpperCase()}</div>
          <div style="min-width:0">
            <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="sidebar-profile-name">${profile.full_name || profile.email}</div>
            <div style="font-size:9px" class="sidebar-profile-role">${profile.role || 'member'}</div>
          </div>
        </div>
        <button class="logout-btn" id="btn-logout">Sign Out</button>
      ` : ''}
      ${state.dbStatus === 'connected'
        ? '<div style="margin-top:8px;color:#10b981;font-size:10px">● Database live</div>'
        : state.dbStatus === 'error'
        ? '<div style="margin-top:8px;color:#ef4444;font-size:10px">● DB error</div>'
        : state.dbStatus === 'not-configured'
        ? '<div style="margin-top:8px;color:#8888a0;font-size:10px">● Local only</div>'
        : ''}
    </div>
  </aside>`;
}

function renderTopbar() {
  const profile = currentProfile;
  return `<header class="topbar">
    <div class="topbar-search">
      <input type="text" id="global-search" placeholder="Search leads, candidates, projects…  ( / )" autocomplete="off" />
      <div id="global-search-results" class="search-results" style="display:none"></div>
    </div>
    <div class="topbar-actions">
      <button id="btn-theme-toggle" class="theme-toggle" title="Toggle theme">${state.darkMode ? '☀' : '☾'}</button>
      <button id="btn-notif-toggle" class="topbar-bell" title="Notifications">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
        ${state.unreadCount > 0 ? `<span class="bell-badge">${state.unreadCount}</span>` : ''}
      </button>
      <div class="user-menu-wrap">
        <button id="btn-user-menu" class="avatar-chip" title="${escHtml(profile?.full_name || profile?.email || '')}">${(profile?.full_name || profile?.email || '?')[0].toUpperCase()}</button>
        <div id="user-menu" class="user-menu" style="display:none">
          <div class="user-menu-name">${escHtml(profile?.full_name || profile?.email || '')}</div>
          <div class="user-menu-role">${escHtml(profile?.role || 'member')}</div>
          <button id="btn-logout-menu" class="user-menu-signout">Sign Out</button>
        </div>
      </div>
    </div>
  </header>`;
}

function renderTabs() {
  const page = pageForView(state.view);
  if (page.tabs.length < 2) return '';
  const current = activeTab(page);
  return `<div class="page-tabs">
    ${page.tabs.filter(t => can(t.module || page.id, 'view')).map(t => {
      const n = t.count ? t.count() : null;
      return `<button class="page-tab ${current === t ? 'active' : ''}" data-tab="${t.key}" data-tab-page="${page.id}">
        ${t.label}${n != null ? ` <span class="page-tab-count">${n}</span>` : ''}
      </button>`;
    }).join('')}
  </div>`;
}

// ── View switch (same old view ids; views now live in page modules) ──
function renderView() {
  if (state.view === 'home')           return renderHome();
  if (state.view === 'team')           return renderTeam();
  if (state.view === 'leads')          return renderLeads();
  if (state.view === 'projects')       return renderProjects();
  if (state.view === 'articles')       return renderArticlesView();
  if (state.view === 'social-planner') return renderSocialPlanner();
  if (state.view === 'analytics')      return renderAnalyticsView();
  if (state.view === 'agents')         return renderAgentsView();
  if (state.view === 'map')            return renderMapView();
  if (state.view === 'contact-subs')   return renderContactSubmissions();
  if (state.view === 'notifications')  return renderNotificationsView();
  if (state.view === 'general-cvs')    return renderGeneralCVs();
  if (state.view === 'job-apps')       return renderJobApplications();
  if (state.view === 'ai-assessments') return renderAIAssessments();
  if (state.view === 'files')          return renderFilesView();
  if (state.view === 'tasks')          return renderTasksView();
  if (state.view === 'pipeline')       return renderPipeline();
  if (state.view === 'recruiting')     return renderRecruiting();
  if (state.view === 'social')         return renderSocial();
  if (state.view === 'icp')            return renderICP();
  if (state.view === 'disqualify')     return renderDisqualify();
  if (state.view === 'outreach')       return renderOutreach();
  if (state.view === 'job-board')      return renderJobBoard();
  return '';
}

// ── Auth screen (unchanged) ───────────────────────────────────────────
function renderAuthScreen() {
  const isLogin = state.authView === 'login';
  return `
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg);padding:20px;width:100%">
    <div style="width:100%;max-width:400px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-weight:800;font-size:28px;letter-spacing:-0.5px;margin-bottom:6px">IT<span style="color:var(--accent-2)">Impact</span></div>
        <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em">CRM & Project Management</div>
      </div>
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:16px;padding:28px 32px">
        <div style="display:flex;gap:0;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
          <button class="auth-tab ${isLogin ? 'active' : ''}" data-authview="login" style="flex:1;padding:10px;border:none;cursor:pointer;font-size:12px;background:${isLogin ? 'var(--accent-glow)' : 'var(--bg-3)'};color:${isLogin ? 'var(--accent-2)' : 'var(--text-3)'};transition:all 0.15s">Sign In</button>
          <button class="auth-tab ${!isLogin ? 'active' : ''}" data-authview="signup" style="flex:1;padding:10px;border:none;border-left:1px solid var(--border);cursor:pointer;font-size:12px;background:${!isLogin ? 'var(--accent-glow)' : 'var(--bg-3)'};color:${!isLogin ? 'var(--accent-2)' : 'var(--text-3)'};transition:all 0.15s">Sign Up</button>
        </div>
        ${state.authError ? `<div style="padding:10px 12px;background:var(--red-glow);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:12px;color:var(--red);margin-bottom:16px">${state.authError}</div>` : ''}
        <form id="auth-form">
          ${!isLogin ? `
          <div style="margin-bottom:14px">
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Full Name</label>
            <input type="text" name="fullName" required style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;" placeholder="Amish Mirza" />
          </div>` : ''}
          <div style="margin-bottom:14px">
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Email</label>
            <input type="email" name="email" required style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;" placeholder="you@itimpact.com" />
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Password</label>
            <input type="password" name="password" required minlength="6" style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;" placeholder="••••••••" />
          </div>
          <button type="submit" style="width:100%;padding:12px;background:var(--gradient-navy);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 2px 12px rgba(99,102,241,0.3);transition:all 0.15s" ${state.authLoading ? 'disabled' : ''}>
            ${state.authLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  </div>`;
}

function attachAuthEvents() {
  document.querySelectorAll('[data-authview]').forEach(el => {
    el.addEventListener('click', () => { state.authView = el.dataset.authview; state.authError = null; render(); });
  });
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.authLoading = true;
    state.authError = null;
    render();
    const fd = new FormData(form);
    try {
      if (state.authView === 'login') {
        await signIn(fd.get('email'), fd.get('password'));
      } else {
        await signUp(fd.get('email'), fd.get('password'), fd.get('fullName'));
        showToast('Account created! You can now sign in.', 'success');
        state.authView = 'login';
      }
    } catch (err) {
      state.authError = err.message;
    }
    state.authLoading = false;
    render();
  });
}

// ── Render ────────────────────────────────────────────────────────────
function render() {
  if (!state.authenticated) {
    document.getElementById('app').innerHTML = renderAuthScreen();
    attachAuthEvents();
    return;
  }
  // Read-only members get a UI-level interaction gate on the content area
  const viewOnly = ['view', 'comment'].includes(accessLevel(moduleForView(state.view)));
  document.getElementById('app').innerHTML = `
    ${renderSidebar()}
    <div class="content-wrap">
      ${renderTopbar()}
      <main class="main ${viewOnly ? 'access-view' : ''}" id="main-content">
        ${viewOnly ? '<div class="access-banner">Read-only access — contact an admin to request edit rights</div>' : ''}
        ${renderTabs()}
        ${renderView()}
      </main>
    </div>
    <div class="toast-container" id="toast-container"></div>`;
  attachEvents();
  if (state.modal) app.renderModal();
  if (state.leadModal) {
    const el = document.createElement('div');
    el.innerHTML = renderLeadModal();
    document.body.appendChild(el.firstElementChild);
    attachLeadModalEvents();
  }
  if (state.articleModal) {
    const el = document.createElement('div');
    el.innerHTML = renderArticleModal();
    document.body.appendChild(el.firstElementChild);
    attachArticleModalEvents();
  }
  if (state.socialPostModal) {
    const el = document.createElement('div');
    el.innerHTML = renderSocialPostModal();
    document.body.appendChild(el.firstElementChild);
    attachSocialPostModalEvents();
  }
  if (state.taskModal) {
    const el = document.createElement('div');
    el.innerHTML = renderTaskModal();
    document.body.appendChild(el.firstElementChild);
    attachTaskModalEvents();
  }
  if (state.showApiKeyModal) {
    const el = document.createElement('div');
    el.innerHTML = renderApiKeyModal();
    document.body.appendChild(el.firstElementChild);
    attachApiKeyModalEvents();
  }
  if (state.accessMemberData) {
    const el = document.createElement('div');
    el.innerHTML = renderAccessModal();
    if (el.firstElementChild) {
      document.body.appendChild(el.firstElementChild);
      attachAccessModalEvents();
    }
  }
  // Notification panel (slide-over)
  const existingNotif = document.getElementById('notif-panel');
  if (existingNotif) existingNotif.remove();
  if (state.showNotifPanel) {
    const el = document.createElement('div');
    el.innerHTML = renderNotifPanel();
    document.body.appendChild(el.firstElementChild);
    if (el.querySelector('style')) document.body.appendChild(el.querySelector('style'));
    attachNotifEvents();
  }
  // Record slide-overs (Phase 3)
  document.getElementById('lead-panel')?.remove();
  if (state.leadPanel) {
    const el = document.createElement('div');
    el.innerHTML = renderLeadPanel();
    if (el.firstElementChild) {
      document.body.appendChild(el.firstElementChild);
      attachLeadPanelEvents();
    }
  }
  document.getElementById('candidate-panel')?.remove();
  if (state.candidatePanel) {
    const el = document.createElement('div');
    el.innerHTML = renderCandidatePanel();
    if (el.firstElementChild) {
      document.body.appendChild(el.firstElementChild);
      attachCandidatePanelEvents();
    }
  }
  // Job Board detail panel
  document.getElementById('job-detail-overlay')?.remove();
  if (state.jobBoardSelected) {
    const el = document.createElement('div');
    el.innerHTML = renderJobDetailPanel();
    if (el.firstElementChild) {
      document.body.appendChild(el.firstElementChild);
      attachJobBoardEvents();
    }
  }
}

// ── Global search (Phase 3) ───────────────────────────────────────────
// Searches leads, candidates, projects and website submissions in memory;
// grouped dropdown; Enter/click opens the record. "/" focuses the input.
function searchAll(q) {
  const needle = q.toLowerCase();
  const hit = (...fields) => fields.some(f => (f || '').toLowerCase().includes(needle));
  const groups = [];
  const leads = state.leads.filter(l => hit(l.name, l.company, l.email)).slice(0, 5)
    .map(l => ({ label: l.name, sub: l.company || l.email || 'Lead', action: () => openLeadRecord(l.id) }));
  const cands = candidates.filter(c => hit(c.name, c.currentRole, c.currentCompany)).slice(0, 5)
    .map(c => ({ label: c.name, sub: `${c.currentRole} · ${c.currentCompany}`, action: () => openCandidateRecord(c.id) }));
  const projs = state.projects.filter(p => hit(p.name, p.description)).slice(0, 5)
    .map(p => ({ label: p.name, sub: p.description || 'Project', action: () => openProjectRecord(p.id) }));
  const subs = [
    ...state.contactSubmissions.map(s => ({ s, view: 'contact-subs', prefix: 'contact-', kind: 'Contact enquiry' })),
    ...state.generalCVs.map(s => ({ s, view: 'general-cvs', prefix: 'cv-', kind: 'General CV' })),
    ...state.jobApplications.map(s => ({ s, view: 'job-apps', prefix: 'job-', kind: s.position_title ? `Applied · ${s.position_title}` : 'Job application' })),
  ].filter(x => hit(x.s.full_name, x.s.email, x.s.company)).slice(0, 5)
    .map(x => ({ label: x.s.full_name, sub: x.kind, action: () => openSubmissionRecord(x.view, x.prefix + x.s.id) }));
  if (leads.length) groups.push({ group: 'Leads', items: leads });
  if (cands.length) groups.push({ group: 'Candidates', items: cands });
  if (projs.length) groups.push({ group: 'Projects', items: projs });
  if (subs.length) groups.push({ group: 'Submissions', items: subs });
  return groups;
}

async function openLeadRecord(id) { await navigate('leads'); state.leadPanel = id; render(); }
async function openCandidateRecord(id) { await navigate('recruiting', { set: () => { state.recTab = 'candidates'; } }); state.candidatePanel = id; render(); }
async function openProjectRecord(id) { await navigate('projects'); const p = state.projects.find(x => x.id === id); if (p) await openProject(p); }
async function openSubmissionRecord(view, expandedId) { await navigate(view); state.expandedSubmission = expandedId; render(); }

function attachGlobalSearch() {
  const gs = document.getElementById('global-search');
  const gsResults = document.getElementById('global-search-results');
  if (!gs || !gsResults) return;
  let currentGroups = [];
  const closeResults = () => { gsResults.style.display = 'none'; gsResults.innerHTML = ''; currentGroups = []; };
  const pick = (item) => { closeResults(); gs.value = ''; gs.blur(); item.action(); };
  gs.addEventListener('input', () => {
    const q = gs.value.trim();
    if (q.length < 2) { closeResults(); return; }
    currentGroups = searchAll(q);
    if (!currentGroups.length) {
      gsResults.innerHTML = '<div class="search-empty">No matches</div>';
      gsResults.style.display = 'block';
      return;
    }
    gsResults.innerHTML = currentGroups.map((g, gi) => `
      <div class="search-group">
        <div class="search-group-label">${g.group}</div>
        ${g.items.map((it, ii) => `
          <div class="search-item" data-gs="${gi}:${ii}">
            <span class="search-item-label">${escHtml(it.label)}</span>
            <span class="search-item-sub">${escHtml(it.sub)}</span>
          </div>`).join('')}
      </div>`).join('');
    gsResults.style.display = 'block';
    gsResults.querySelectorAll('[data-gs]').forEach(el => {
      // mousedown so the pick lands before the input's blur handler
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const [gi, ii] = el.dataset.gs.split(':').map(Number);
        pick(currentGroups[gi].items[ii]);
      });
    });
  });
  gs.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = currentGroups[0]?.items[0];
      if (first) pick(first);
    } else if (e.key === 'Escape') { closeResults(); gs.blur(); }
  });
  gs.addEventListener('blur', () => setTimeout(closeResults, 150));
}

// "/" focuses global search from anywhere (registered once)
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const gs = document.getElementById('global-search');
    if (gs) { e.preventDefault(); gs.focus(); }
  }
});

// ── Shell events ──────────────────────────────────────────────────────
function attachEvents() {
  attachGlobalSearch();
  // Sign out (sidebar + user menu)
  const doSignOut = async () => {
    await signOut();
    state.authenticated = false;
    render();
  };
  document.getElementById('btn-logout')?.addEventListener('click', doSignOut);
  document.getElementById('btn-logout-menu')?.addEventListener('click', doSignOut);

  // Sidebar: page click → first tab of that page
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const page = PAGES.find(p => p.id === el.dataset.page);
      if (!page) return;
      const tab = page.tabs[0];
      navigate(tab.view, { set: tab.set });
    });
  });

  // Tab bar
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const page = PAGES.find(p => p.id === el.dataset.tabPage);
      const tab = page?.tabs.find(t => t.key === el.dataset.tab);
      if (tab) navigate(tab.view, { set: tab.set });
    });
  });

  // Legacy deep links (home KPI cards, quick actions, notif links use data-nav="<view>")
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // User menu toggle
  const menuBtn = document.getElementById('btn-user-menu');
  const menu = document.getElementById('user-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true });
  }

  // Page-specific handlers (same order as the pre-split attachEvents)
  attachSalesEvents();
  attachRecruitingEvents();
  attachContentEngineEvents();
  attachCopyButtons();
  attachLeadEvents();
  attachProjectEvents();
  attachTeamEvents();
  attachArticleEvents();
  attachSocialPlannerEvents();
  attachAnalyticsEvents();
  attachAgentEvents();
  attachMapEvents();
  attachSubmissionEvents();
  attachTaskEvents();
  attachNotificationsViewEvents();
  if (state.view === 'job-board') attachJobBoardEvents();

  // Theme toggle
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : '');
    localStorage.setItem('theme', state.darkMode ? 'dark' : 'light');
    render();
  });

  // Notification bell toggle
  document.getElementById('btn-notif-toggle')?.addEventListener('click', async () => {
    state.showNotifPanel = !state.showNotifPanel;
    if (state.showNotifPanel) {
      state.notifications = await fetchNotifications();
      state.unreadCount = await getUnreadCount();
    }
    render();
  });
}

// Back/forward navigation between pages
window.addEventListener('hashchange', () => {
  const parsed = parseHash();
  if (!parsed) return;
  const current = activeTab(pageForView(state.view));
  if (parsed.tab === current && parsed.tab.view === state.view) return;
  navigate(parsed.tab.view, { set: parsed.tab.set });
});

// Wire shell hooks for page modules
app.render = render;
app.renderModal = renderModal;

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  // Handle OAuth redirects
  const params = new URLSearchParams(location.search);
  if (params.get('google_connected') === '1') {
    localStorage.setItem('google_connected', '1');
    window.history.replaceState({}, '', location.pathname);
  }
  if (params.get('linkedin_connected') === '1') {
    localStorage.setItem('linkedin_connected', '1');
    window.history.replaceState({}, '', location.pathname);
  }

  if (state.darkMode) document.documentElement.setAttribute('data-theme', 'dark');

  document.getElementById('app').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;background:var(--bg);color:var(--text-3);font-size:12px;flex-direction:column;gap:12px">
      <div style="width:24px;height:24px;border:2px solid rgba(99,102,241,0.3);border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite"></div>
      ${DB_ENABLED ? 'Connecting...' : 'Loading…'}
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

  if (DB_ENABLED) {
    const user = await initAuth();
    state.authenticated = !!user;
    window.addEventListener('auth-change', () => {
      const wasAuth = state.authenticated;
      state.authenticated = !!currentUser;
      if (state.authenticated && !wasAuth) {
        state.view = 'home';
        syncHash();
      }
      if (wasAuth !== state.authenticated) render();
    });
  } else {
    state.authenticated = true;
  }

  if (DB_ENABLED) {
    try {
      const dbState = await loadDbState();
      Object.entries(dbState.prospects).forEach(([id, row]) => {
        const p = prospects.find(x => String(x.id) === id);
        if (p) {
          p.stage           = row.stage            ?? p.stage;
          p.notes           = row.notes            ?? p.notes;
          p.researchDone    = row.research_done    ?? p.researchDone;
          p.outreachWritten = row.outreach_written ?? p.outreachWritten;
          p.spokenTo        = row.spoken_to        ?? p.spokenTo;
          p.meetingBooked   = row.meeting_booked   ?? p.meetingBooked;
          p.meetingDate     = row.meeting_date     ?? p.meetingDate;
        }
      });
      Object.entries(dbState.candidates).forEach(([id, row]) => {
        const c = candidates.find(x => String(x.id) === id);
        if (c) {
          c.status    = row.status     ?? c.status;
          c.emailSent = row.email_sent ?? c.emailSent;
          c.notes     = row.notes      ?? c.notes;
        }
      });
      dbState.added.forEach(p => {
        if (!prospects.find(x => String(x.id) === String(p.id))) {
          prospects.push(p);
          addedFromSearch.push(p);
        }
      });
      state.dbStatus = 'connected';
    } catch (e) {
      console.warn('DB load failed', e);
      state.dbStatus = 'error';
    }
  } else {
    state.dbStatus = 'not-configured';
  }

  if (state.authenticated) {
    // Restore location from URL hash (refresh keeps you in place)
    const parsed = parseHash();
    if (parsed) {
      state.view = parsed.tab.view;
      if (parsed.tab.set) parsed.tab.set();
    } else {
      state.view = 'home';
    }
    syncHash();
    state.leadsLoading = true;
    render();
    const [leads, projects, team, socialPosts, contactSubs, generalCVs, jobApps, unread, tasks, dbPositions, dbCandidates] = await Promise.all([
      fetchLeads(),
      fetchProjects(),
      fetchTeam(),
      fetchSocialPosts(),
      fetchContactSubmissions(),
      fetchGeneralCVs(),
      fetchJobApplications(),
      getUnreadCount(),
      fetchTasks(),
      fetchDbPositions(),
      fetchDbCandidates(),
    ]);
    state.leads = leads;
    state.projects = projects;
    state.team = team;
    state.socialPosts = socialPosts;
    state.contactSubmissions = contactSubs;
    state.generalCVs = generalCVs;
    state.jobApplications = jobApps;
    state.leadsLoading = false;
    state.unreadCount = unread;
    state.tasks = tasks;
    state.dbPositions = dbPositions.rows;
    state.dbCandidates = dbCandidates.rows;
    state.recruitingDbReady = dbPositions.tableExists;
    state.notifUnsub = subscribeToNotifications((notif) => {
      state.unreadCount++;
      showToast(notif.title, 'info');
      render();
    });
    // Views not covered by the parallel load above (e.g. articles, analytics)
    await loadViewData(state.view);
  }
  render();
  checkBackend().then(bs => { state.backendStatus = bs; });
}

boot();
