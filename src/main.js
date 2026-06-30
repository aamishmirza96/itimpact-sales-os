import {
  STAGES, prospects as rawProspects,
  icpProfile, buyingTriggers, bestClients,
  apolloFilters, disqualifiers, outreachSequences
} from './data.js';
import { positions, candidates as rawCandidates, CANDIDATE_STATUSES } from './recruiting.js';
import { supabase, DB_ENABLED, loadDbState, syncProspect, syncCandidate, syncAddedProspect } from './supabase.js';
import { initAuth, currentUser, currentProfile, signIn, signUp, signOut, getTeamMembers } from './auth.js';
import { LEAD_STATUSES, fetchLeads, createLead, updateLead, deleteLead } from './leads.js';
import { fetchTeamMembers as fetchTeam, updateProfile } from './team.js';
import { fetchArticles, createArticle, updateArticle, deleteArticle } from './articles.js';
import { fetchSocialPosts, createSocialPost, approvePost, updatePostStatus, deleteSocialPost } from './social-planner.js';
import { fetchNotifications, getUnreadCount, markAsRead, markAllRead, sendNotification, subscribeToNotifications } from './notifications.js';
import { fetchAnalyticsOverview, fetchLiveVisitors, flagFor } from './analytics.js';
import { getApiKey, getProvider, setApiKey, clearApiKey, hasApiKey, runMarketingPlannerAgent, runLeadFinderAgent, runHRHeadhunterAgent, runChatAssistant, runJarvis } from './ai-agents.js';
import { buildGraph, NODE_TYPE_LABELS } from './relationship-map.js';
import {
  fetchProjects, createProject, fetchProjectMembers, addProjectMember,
  fetchMessages, createMessage, fetchComments, createComment,
  fetchTodoLists, createTodoList, createTodo, toggleTodo, deleteTodo,
  fetchEvents, createEvent,
  fetchChatMessages, sendChatMessage, subscribeToChatMessages,
  fetchCheckins, createCheckin, respondToCheckin,
} from './projects.js';
import {
  fetchContactSubmissions, updateContactStatus,
  fetchGeneralCVs, updateGeneralCVStatus, updateGeneralCVNotes,
  fetchJobApplications, updateJobApplicationStatus, updateJobApplicationNotes,
  fetchAIAssessments, updateAIAssessmentStatus,
} from './submissions.js';

// ── Persist & State ──────────────────────────────────────────────────
const LS_KEY = 'sales_os_v2';
const LS_ADDED = 'sales_os_added_v2';

function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function loadAdded() { try { return JSON.parse(localStorage.getItem(LS_ADDED)) || []; } catch { return []; } }

const saved = loadSaved();
const addedFromSearch = loadAdded();

const prospects = [
  ...rawProspects.map(p => {
    const s = saved[p.id] || {};
    return { ...p,
      stage: s.stage !== undefined ? s.stage : p.stage,
      notes: s.notes !== undefined ? s.notes : p.notes,
      researchDone: s.researchDone !== undefined ? s.researchDone : p.researchDone,
      outreachWritten: s.outreachWritten !== undefined ? s.outreachWritten : p.outreachWritten,
      spokenTo: s.spokenTo || false,
      meetingBooked: s.meetingBooked || false,
      meetingDate: s.meetingDate || null,
    };
  }),
  ...addedFromSearch,
];

// ── Recruiting state ──────────────────────────────────────────────────
const LS_REC = 'sales_os_recruiting_v1';
function loadRec() { try { return JSON.parse(localStorage.getItem(LS_REC)) || {}; } catch { return {}; } }
const recSaved = loadRec();
const candidates = rawCandidates.map(c => {
  const s = recSaved[c.id] || {};
  return { ...c, status: s.status || c.status, emailSent: s.emailSent !== undefined ? s.emailSent : c.emailSent, notes: s.notes !== undefined ? s.notes : c.notes };
});
function persistCandidate(c) {
  recSaved[c.id] = { status: c.status, emailSent: c.emailSent, notes: c.notes };
  localStorage.setItem(LS_REC, JSON.stringify(recSaved));
  syncCandidate(c); // sync to Supabase in background
}

const state = {
  authenticated: false,
  darkMode: localStorage.getItem('theme') === 'dark',
  authView: 'login',
  authError: null,
  authLoading: false,
  view: 'pipeline',
  stageFilter: -1,
  sectorFilter: 'All',
  sort: 'priority',
  expandedId: null,
  modal: null,       // 'findLeads' | 'email'
  modalData: null,
  findLeadsResults: [],
  findLeadsLoading: false,
  findLeadsError: null,
  backendStatus: null,
  socialPlatform: 'linkedin',
  socialPostType: 'casestudy',
  socialAngle: 'sound',
  searchQuery: '',
  // Leads
  leads: [],
  leadsLoading: false,
  leadFilter: 'all',
  leadModal: null,
  leadEditData: null,
  // Projects
  projects: [],
  projectsLoading: false,
  activeProject: null,
  projectTab: 'board',
  projectMessages: [],
  projectTodoLists: [],
  projectEvents: [],
  projectChat: [],
  projectCheckins: [],
  projectMembers: [],
  teamMembers: [],
  chatUnsub: null,
  // Team
  team: [],
  editMemberData: null,
  // Articles
  articles: [],
  articleModal: null,
  articleEditData: null,
  articleFilter: 'all',
  // Social Planner
  socialPosts: [],
  socialPostModal: null,
  socialPostFilter: 'all',
  // Notifications
  notifications: [],
  unreadCount: 0,
  showNotifPanel: false,
  notifUnsub: null,
  // Analytics
  analyticsData: null,
  analyticsDays: 7,
  googleConnected: localStorage.getItem('google_connected') === '1',
  gaData: null,
  liveVisitors: [],
  liveVisitorsInterval: null,
  // Website Submissions
  contactSubmissions: [],
  generalCVs: [],
  jobApplications: [],
  aiAssessments: [],
  jobAppFilter: 'all',
  expandedSubmission: null,
  // Agents
  activeAgent: null,
  agentLoading: false,
  agentOutput: '',
  agentError: null,
  agentInput: '',
  chatHistory: [],
  showApiKeyModal: false,
  // Map
  mapNodes: [],
  mapEdges: [],
  mapSelectedNode: null,
  mapPositions: {},
  generatedPost: null,
  recTab: 'positions',
  recPosition: null,
  recExpandedCandidate: null,
  dbStatus: null,
  persisted: loadSaved(),
};

function persistProspect(p) {
  state.persisted[p.id] = {
    stage: p.stage, notes: p.notes,
    researchDone: p.researchDone, outreachWritten: p.outreachWritten,
    spokenTo: p.spokenTo, meetingBooked: p.meetingBooked, meetingDate: p.meetingDate,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(state.persisted));
  syncProspect(p); // sync to Supabase in background
}

function persistAdded(p) {
  localStorage.setItem(LS_ADDED, JSON.stringify(addedFromSearch));
  if (p) syncAddedProspect(p); // sync new prospect to Supabase
}

function bantScore(b) { return b.b + b.a + b.n + b.t; }
function avgBant() { return (prospects.reduce((s,p) => s + bantScore(p.bant), 0) / prospects.length).toFixed(1); }

function filteredSorted() {
  let list = [...prospects];
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) || p.sector.toLowerCase().includes(q) || (p.title||'').toLowerCase().includes(q));
  }
  if (state.stageFilter !== -1) list = list.filter(p => p.stage === state.stageFilter);
  if (state.sectorFilter !== 'All') list = list.filter(p => p.sector === state.sectorFilter);
  if (state.sort === 'priority') list.sort((a,b) => { if (a.priority !== b.priority) return a.priority?-1:1; return bantScore(b.bant)-bantScore(a.bant); });
  else if (state.sort === 'bant') list.sort((a,b) => bantScore(b.bant)-bantScore(a.bant));
  else if (state.sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  else if (state.sort === 'stage') list.sort((a,b) => a.stage-b.stage);
  return list;
}

// ── Toast ─────────────────────────────────────────────────────────────
function showToast(msg, type='info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id='toast-container'; c.className='toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(()=>t.remove(),300); }, 2800);
}

// ── API ───────────────────────────────────────────────────────────────
async function checkBackend() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    state.backendStatus = d;
    return d;
  } catch { state.backendStatus = { status:'unreachable' }; return null; }
}

async function searchApolloLeads(filters) {
  state.findLeadsLoading = true;
  state.findLeadsError = null;
  renderModal();
  try {
    const r = await fetch('/api/leads/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });
    const d = await r.json();
    if (!r.ok) { state.findLeadsError = d.error || 'Search failed'; state.findLeadsLoading = false; renderModal(); return; }
    state.findLeadsResults = (d.people || []).map(mapApolloPersonToProspect);
    state.findLeadsLoading = false;
    renderModal();
  } catch (e) {
    state.findLeadsError = e.message;
    state.findLeadsLoading = false;
    renderModal();
  }
}

function mapApolloPersonToProspect(ap) {
  const lastName = ap.last_name_obfuscated || '***';
  const firstName = ap.first_name || '';
  const initials = (firstName[0]||'') + (lastName[0]||'');
  const score = guessBANT(ap);
  return {
    id: 'a_' + ap.id,
    name: `${firstName} ${lastName}`,
    initials: initials.toUpperCase(),
    title: ap.title || '',
    company: ap.organization?.name || '',
    sector: guessSector(ap),
    location: ap.city ? `${ap.city}, ${ap.state || ''}` : 'United States',
    stage: 0,
    bant: score,
    priority: bantScore(score) >= 17,
    email: ap.has_email ? 'Enrichment required' : 'Not available in Apollo',
    linkedin: 'Enrichment required',
    signal: buildSignal(ap),
    lastContact: null, notes: '',
    researchDone: false, outreachWritten: false,
    spokenTo: false, meetingBooked: false, meetingDate: null,
    source: 'Apollo Agent',
  };
}

function guessBANT(ap) {
  const title = (ap.title||'').toLowerCase();
  const org = (ap.organization?.name||'').toLowerCase();
  const b = org.includes('private equity')||org.includes('pe ')||org.includes('capital')||org.includes('partner') ? 4 : 3;
  const a = title.includes('managing partner')||title.includes('chief')||title.includes('cio')||title.includes('cto') ? 5 : title.includes('vp')||title.includes('partner') ? 4 : 3;
  const n = title.includes('portfolio')||title.includes('operating')||title.includes('cio')||title.includes('cto') ? 4 : 3;
  const t = ap.organization?.has_revenue ? 4 : 3;
  return { b, a, n, t };
}

function guessSector(ap) {
  const name = (ap.organization?.name||'').toLowerCase();
  if (name.includes('dental')||name.includes('ortho')) return 'Dental';
  if (name.includes('health')||name.includes('medical')||name.includes('hospital')||name.includes('clinic')) return 'Healthcare';
  if (name.includes('venture')||name.includes('capital')||name.includes('equity')||name.includes('partner')) return 'PE/VC';
  return 'PE/VC';
}

function buildSignal(ap) {
  const title = ap.title||'Unknown Title';
  const company = ap.organization?.name||'Unknown Company';
  const size = ap.organization?.has_employee_count ? 'company' : 'firm';
  return `${title} at ${company} — found via Apollo ICP search. ${ap.has_email?'Email available in Apollo.':''} ${ap.has_direct_phone==='Yes'?'Direct phone available.':''}`.trim();
}

// ── Email Generator ───────────────────────────────────────────────────
const REF_CLIENTS = {
  Healthcare: { name:'Sound Physicians', desc:'$1B+, 4,000 providers', outcome:'end-to-end IT assessment + AI/LLM infrastructure deployment that scaled across their entire provider network' },
  Dental:     { name:'Clove Dental', desc:'major dental network', outcome:'digital front-door experience + custom application suite that drove operational efficiency and patient growth' },
  'PE/VC':    { name:'Oshi Health (PE-backed)', desc:'fast-growing healthcare platform', outcome:'100-hour IT audit, product/IT org redesign, and record-breaking quarterly performance' },
  Advisory:   { name:'Oshi Health (PE-backed)', desc:'fast-growing healthcare platform', outcome:'100-hour IT audit and IT org redesign post-acquisition' },
};

const SECTOR_PATTERNS = {
  Healthcare: 'PE-backed healthcare platforms hit the same wall: fragmented EMR integrations, no unified data layer, and AI initiatives that stall because the infrastructure isn\'t there',
  Dental:     'Multi-state dental DSOs scaling past 50 locations consistently run into the same IT ceiling — disparate practice management systems, no shared data architecture, and a digital patient experience that doesn\'t match the brand',
  'PE/VC':    'Portfolio companies acquired in the last 12–24 months are operating on inherited tech stacks. The 100-day value creation plan rarely includes an IT assessment — and that gap compounds fast',
  Advisory:   'Portfolio companies consistently lack enterprise-grade IT leadership in the first 2–3 years post-acquisition',
};

const CLOSING_QUESTIONS = {
  Healthcare: 'Is there a current AI infrastructure or IT leadership gap across your health system?',
  Dental:     'Is there a current digital infrastructure initiative underway — or is that gap still waiting to be addressed?',
  'PE/VC':    'What does the current IT maturity look like across your active portfolio — and is there a specific platform where the gap is most acute?',
  Advisory:   'Is there a portfolio company where an IT assessment or fractional CIO engagement would create immediate value?',
};

function generateEmail(p) {
  const firstName = p.name.split(' ')[0];
  const ref = REF_CLIENTS[p.sector] || REF_CLIENTS.Healthcare;
  const pattern = SECTOR_PATTERNS[p.sector] || SECTOR_PATTERNS.Healthcare;
  const closing = CLOSING_QUESTIONS[p.sector] || CLOSING_QUESTIONS.Healthcare;

  const hook = buildEmailHook(p);
  const subject = buildSubjectLine(p);

  const body = `${firstName},\n\n${hook}\n\n${pattern}.\n\nWe built the solution for ${ref.name} (${ref.desc}) — ${ref.outcome}.\n\n${closing}`;

  const linkedin = `${firstName} — ${buildLinkedInHook(p)} I work with ${p.sector === 'PE/VC' ? 'PE-backed platforms' : p.sector.toLowerCase() + ' organizations'} on exactly that execution layer — Fractional CIO, AI assessments, IT infrastructure. Worth connecting.`;

  const followUp = `${firstName},\n\nFollowing up on my note from last week.\n\nI know inboxes are noisy — but the reason I reached out specifically is ${buildSpecificReason(p)}.\n\nWorth a 15-minute call this week?`;

  return { subject, body, linkedin, followUp };
}

function buildEmailHook(p) {
  const sig = p.signal || '';
  if (sig.includes('acquired') || sig.includes('acquisition')) return `The ${p.company} acquisition tells me the team is moving fast — and that the tech integration work is either already underway or about to land on someone's desk.`;
  if (sig.includes('Triage') || sig.includes('fractional')) return `Your title caught my attention — "Triage-CIO" makes it clear you already understand the value of fractional IT leadership. The question is whether the model you\'re currently using matches the pace of what ${p.company} is building.`;
  if (sig.includes('dual') || sig.includes('Dual') || sig.includes('/')) return `Managing ${p.title} at ${p.company} simultaneously tells me you\'re covering a lot of ground with a lean team. That\'s exactly the situation where a fractional CIO engagement delivers the highest leverage.`;
  if (sig.includes('AI') || sig.includes('agentic') || sig.includes('LLM')) return `The AI initiative at ${p.company} is the right move. The harder question — one most teams underestimate — is what the underlying IT infrastructure looks like when those use cases scale beyond the pilot.`;
  if (sig.includes('breach') || sig.includes('security')) return `The security incident at ${p.company} creates an immediate mandate for infrastructure review. That kind of event either accelerates the IT modernization timeline — or exposes exactly how fragmented the stack has become.`;
  return `I've been tracking ${p.company}'s growth and the ${p.sector} market more broadly — and your role sits exactly at the intersection of where IT leadership gaps create the most risk and the most opportunity.`;
}

function buildLinkedInHook(p) {
  const sig = p.signal || '';
  if (sig.includes('AI') || sig.includes('agentic')) return `saw the AI work happening at ${p.company} — impressive direction.`;
  if (sig.includes('acquired') || sig.includes('acquisition')) return `noticed the recent acquisition activity at ${p.company}.`;
  if (sig.includes('Triage') || sig.includes('fractional')) return `your Triage-CIO title immediately stood out — rare to see that level of clarity about the model.`;
  return `noticed ${p.company}'s growth trajectory in ${p.sector}.`;
}

function buildSpecificReason(p) {
  const sig = p.signal || '';
  if (p.sector === 'Dental') return `${p.company} matches the exact profile of our Clove Dental engagement — PE-backed DSO scaling across multiple states with a digital infrastructure gap that compounds as location count grows`;
  if (p.sector === 'Healthcare') return `${p.company}'s profile mirrors Sound Physicians before we engaged them — complex multi-site operations, AI ambitions, and an IT layer that wasn\'t built for the scale they\'re running at`;
  return `${p.company} is at the stage where PE-backed platforms typically either accelerate their IT maturity or watch it become a drag on the value creation timeline`;
}

function buildSubjectLine(p) {
  const sector = p.sector;
  const company = p.company;
  const map = {
    Healthcare: [`${company} — AI infrastructure beyond the pilot`, `${company} — IT layer for what comes next`, `${company} — scaling the clinical AI stack`],
    Dental: [`${company} — digital infrastructure for multi-state scale`, `${company} — IT foundation for DSO growth`, `${company} — beyond the practice management system`],
    'PE/VC': [`${company} portfolio — IT due diligence gap`, `${company} — fractional CIO across portfolio`, `${company} platforms — AI readiness across the stack`],
    Advisory: [`${company} — channel partner opportunity`, `${company} — fractional CIO collaboration`],
  };
  const lines = map[sector] || map.Healthcare;
  return lines[0];
}

// ── Social Media Post Generator ───────────────────────────────────────
const SOCIAL_POSTS = {
  linkedin: {
    casestudy: {
      sound: {
        title: 'Sound Physicians Case Study',
        post: `We ran a full IT assessment across a $1B+ physician group with 4,000+ providers.\n\nHere's what we found in the first 30 days:\n\n• 7 disconnected EMR integrations with no shared data layer\n• 3 separate "AI initiatives" with no unified infrastructure\n• A CIO role that had been vacant for 11 months\n\nThe 100-day plan:\n1. Map every data flow across the organization\n2. Build the AI/LLM infrastructure layer\n3. Establish fractional CIO leadership with embedded talent\n\nResult: Live AI infrastructure across the entire provider network. Ahead of schedule.\n\nThe lesson: PE-backed healthcare platforms don't need more AI pilots. They need the infrastructure to run them at scale.\n\n#HealthcareIT #FractionalCIO #AIInfrastructure #PrivateEquity`,
      },
      oshi: {
        title: 'Oshi Health Case Study',
        post: `100-hour IT audit. 1 company. Everything changed.\n\nOshi Health brought us in for a rapid IT assessment post-funding round.\n\nWhat we found:\n• Product and IT orgs operating on separate roadmaps\n• No shared data infrastructure between clinical and operational systems\n• Hiring for a full-time CIO when a fractional engagement was the right move\n\nWhat we delivered:\n• Full product/IT org redesign\n• Unified data architecture\n• Fractional CIO leadership embedded through the transition\n\nRecord-breaking quarterly performance followed.\n\nFractional CIO isn't a compromise. For PE-backed platforms scaling fast, it's the exact right tool.\n\n#HealthTech #PrivateEquity #FractionalCIO #ITLeadership`,
      },
      clove: {
        title: 'Clove Dental Case Study',
        post: `Most dental DSOs scale the operations. Few scale the digital infrastructure.\n\nClove Dental was different — they wanted both.\n\nWe built:\n• A digital front-door experience that matched their brand promise\n• A custom application suite for operational efficiency\n• IT infrastructure designed for multi-state expansion\n• Patient care technology that actually improved outcomes\n\nThe result: A technology layer that could scale as fast as their acquisition strategy.\n\nPE-backed dental DSOs are among the most interesting IT challenges in healthcare today. The complexity of multi-state operations + consumer brand expectations + clinical compliance = an infrastructure problem that most CIOs don't have time to solve alone.\n\nThat's where fractional CIO leadership creates the most leverage.\n\n#DentalDSO #HealthcareIT #FractionalCIO #PrivateEquity`,
      },
    },
    insight: {
      pe: {
        title: 'PE IT Insight',
        post: `PE firms spend months on financial due diligence.\n\nMost spend less than 2 days on IT due diligence.\n\nHere's what gets missed:\n\n• Legacy ERP systems that block the integration thesis\n• Security debt that becomes a liability post-close\n• Data infrastructure that can't support the AI roadmap the board wants\n• IT leadership gaps that don't surface until the 100-day plan stalls\n\nThe firms that catch this early don't have better financial models.\n\nThey have an IT operating partner who's done this before.\n\n#PrivateEquity #ITDueDiligence #ValueCreation #FractionalCIO`,
      },
      ai: {
        title: 'AI in Healthcare',
        post: `Every PE-backed healthcare platform now has an "AI strategy."\n\nMost will fail to execute.\n\nNot because the models aren't good enough.\nBecause the infrastructure underneath them isn't built for production.\n\nThe 3 things that kill healthcare AI deployments:\n\n1. No unified data layer across systems (EMR, billing, ops all siloed)\n2. No embedded technical leadership to drive adoption\n3. Pilots that work in isolation but break at scale\n\nSound Physicians ran into all three. We fixed all three.\n\nAI in healthcare isn't a strategy problem. It's an infrastructure problem.\n\n#HealthcareAI #AIInfrastructure #FractionalCIO #DigitalHealth`,
      },
    },
    hottake: {
      cio: {
        title: 'Hot Take: Full-Time CIO',
        post: `Hiring a full-time CIO for your PE portfolio company is almost always the wrong move in years 1–3.\n\nControversial? Maybe. But here's the math:\n\n• Full-time CIO: $350K–$500K fully loaded + 6-month search timeline\n• Fractional CIO: Engaged in 2 weeks, embedded immediately, 30–60% of the cost\n\nMore importantly:\n\nA full-time CIO hire signals you know exactly what you need. Most PE portfolio companies don't — they need someone who can assess, prioritize, and build the roadmap BEFORE you hire permanently.\n\nFractional CIO isn't a budget play.\n\nIt's the right sequence.\n\nAssess → Build → Hire permanent when you know exactly what you need.\n\n#PrivateEquity #FractionalCIO #ITLeadership #ValueCreation`,
      },
    },
    question: {
      dso: {
        title: 'Engagement Question',
        post: `Question for anyone in PE-backed healthcare or dental:\n\nWhat's the #1 IT mistake you've seen portfolio companies make in the first 90 days post-acquisition?\n\nFor us, it's almost always the same answer: assuming the inherited tech stack is good enough to scale.\n\nIt never is.\n\n#PrivateEquity #HealthcareIT #DentalDSO #ITLeadership`,
      },
    },
  },
};

function getPostContent() {
  const p = SOCIAL_POSTS;
  const platform = state.socialPlatform;
  const type = state.socialPostType;
  const angle = state.socialAngle;
  try {
    return p[platform]?.[type]?.[angle] || null;
  } catch { return null; }
}

// ── Team View ────────────────────────────────────────────────────────
const CEO_CODE = '123456';
let ceoUnlocked = false;

function renderTeam() {
  const active = state.team.filter(m => m.status !== 'offline');
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Team</div>
      <div class="page-sub">${state.team.length} members · ${active.length} active</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      ${ceoUnlocked ? `
        <button class="find-leads-btn" id="btn-add-member">+ Add Member</button>
        <button id="btn-lock-team" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);color:var(--green);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;display:flex;align-items:center;gap:6px">🔓 Unlocked</button>
      ` : `
        <button id="btn-unlock-team" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;display:flex;align-items:center;gap:6px">🔒 CEO Lock</button>
      `}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${state.team.map(m => {
      const statusColor = m.status==='active' ? 'var(--green)' : m.status==='away' ? 'var(--amber)' : 'var(--text-3)';
      return `
      <div class="rec-cand-card" style="flex-direction:column;gap:0;position:relative">
        ${ceoUnlocked ? `
          <div style="position:absolute;top:12px;right:12px;display:flex;gap:4px">
            <button class="team-edit-btn" data-edit-member="${m.id}" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--accent-2);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all 0.15s" title="Edit">✎</button>
            <button class="team-delete-btn" data-delete-member="${m.id}" data-member-name="${escHtml(m.full_name||m.email)}" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:var(--red-glow);color:var(--red);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all 0.15s" title="Remove">✕</button>
          </div>` : ''}
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
          <div style="width:48px;height:48px;border-radius:12px;background:var(--gradient-accent);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;font-family:Manrope,sans-serif;flex-shrink:0;position:relative">
            ${(m.full_name||m.email||'?')[0].toUpperCase()}
            <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${statusColor};border:2px solid var(--bg-card-flat)"></div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:600;color:var(--text)">${m.full_name||'Unnamed'}</div>
            <div style="font-size:12px;color:var(--accent-2);font-family:'DM Mono',monospace">${m.designation||m.role||'Member'}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">${m.email}</div>
        ${m.department ? `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-bottom:6px">🏢 ${m.department}</div>` : ''}
        ${m.bio ? `<div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-bottom:8px">${m.bio}</div>` : ''}
        ${m.skills?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${m.skills.map(s => `<span class="rec-tag">${s}</span>`).join('')}</div>` : ''}
        ${m.phone ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3)">📞 ${m.phone}</div>` : ''}
      </div>`;
    }).join('')}
    ${state.team.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px;grid-column:1/-1">No team members yet. Sign up users to see them here.</div>' : ''}
  </div>`;
}

function renderAddMemberModal() {
  const m = state.editMemberData || {};
  const isEdit = !!m.id;
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:520px">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Team Member' : 'Add Team Member'}</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="member-form" style="padding:20px 28px 24px">
        ${!isEdit ? `
        <div style="padding:12px 14px;background:var(--amber-glow);border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:12px;color:var(--amber);font-family:'DM Mono',monospace;margin-bottom:16px;line-height:1.6">
          ⚠ New members must sign up at the login page first. This form updates their profile details (designation, department, etc). Enter the email they signed up with.
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Full Name</label>
            <input type="text" name="full_name" value="${escHtml(m.full_name||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Designation</label>
            <input type="text" name="designation" value="${escHtml(m.designation||'')}" placeholder="e.g. CTO, Designer, Sales Lead" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Department</label>
            <input type="text" name="department" value="${escHtml(m.department||'')}" placeholder="e.g. Engineering, Sales" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Phone</label>
            <input type="text" name="phone" value="${escHtml(m.phone||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Designation / Role</label>
            <input type="text" name="designation_role" value="${escHtml(m.designation || m.role || '')}" placeholder="e.g. CEO, CTO, Lead Designer, Sales Head" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Status</label>
            <select name="status" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;font-family:'DM Mono',monospace">
              <option value="active" ${m.status==='active'||!m.status?'selected':''}>Active</option>
              <option value="away" ${m.status==='away'?'selected':''}>Away</option>
              <option value="offline" ${m.status==='offline'?'selected':''}>Offline</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Bio</label>
          <textarea name="bio" rows="2" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;resize:vertical;font-family:Manrope,sans-serif">${escHtml(m.bio||'')}</textarea>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Skills (comma separated)</label>
          <input type="text" name="skills" value="${(m.skills||[]).join(', ')}" placeholder="e.g. React, Sales, AI, Design" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-accent);color:#fff;cursor:pointer;font-family:Manrope,sans-serif;font-weight:700;font-size:13px">${isEdit ? 'Save Changes' : 'Update Member'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Articles View ────────────────────────────────────────────────────
function renderArticlesView() {
  const cats = ['all', ...new Set(state.articles.map(a => a.category).filter(Boolean))];
  const filtered = state.articleFilter === 'all' ? state.articles : state.articles.filter(a => a.category === state.articleFilter);
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Articles</div>
      <div class="page-sub">${state.articles.length} articles · knowledge base</div>
    </div>
    <button class="find-leads-btn" id="btn-new-article">+ New Article</button>
  </div>
  <div class="stage-bar" style="margin-bottom:20px">
    ${cats.map(c => `<div class="stage-chip ${state.articleFilter===c?'active':''}" data-article-filter="${c}">${c==='all'?'All ('+state.articles.length+')':c}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
    ${filtered.map(a => `
      <div class="rec-pos-card" style="cursor:pointer" data-edit-article="${a.id}">
        ${a.cover_image ? `<div style="height:140px;background:url('${a.cover_image}') center/cover;border-radius:12px 12px 0 0"></div>` : `<div style="height:60px;background:linear-gradient(135deg,var(--accent-glow),var(--bg-3));border-radius:12px 12px 0 0"></div>`}
        <div style="padding:16px 18px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="cand-status-pill" style="background:${a.status==='published'?'var(--green-glow)':a.status==='draft'?'rgba(90,90,114,0.15)':'var(--amber-glow)'};color:${a.status==='published'?'var(--green)':a.status==='draft'?'var(--text-3)':'var(--amber)'}">${a.status}</span>
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${a.category||'general'}</span>
          </div>
          <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:6px">${a.title}</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${(a.body||'').replace(/[#*_]/g,'').substring(0,200)}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:10px">${a.author?.full_name||'Unknown'} · ${new Date(a.created_at).toLocaleDateString()}</div>
        </div>
      </div>`).join('')}
    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px;grid-column:1/-1">No articles yet. Click "+ New Article" to create one.</div>' : ''}
  </div>`;
}

function renderArticleModal() {
  const isEdit = !!state.articleEditData?.id;
  const a = state.articleEditData || {};
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Article' : 'New Article'}</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="article-form" style="padding:20px 28px 24px">
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Title *</label>
          <input type="text" name="title" required value="${escHtml(a.title||'')}" style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px;outline:none;font-family:Manrope,sans-serif;font-weight:600" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Category</label>
            <input type="text" name="category" value="${escHtml(a.category||'general')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Cover Image URL</label>
            <input type="url" name="cover_image" value="${escHtml(a.cover_image||'')}" placeholder="https://..." style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Content</label>
          <textarea name="body" rows="12" style="width:100%;padding:12px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text-2);font-size:13px;outline:none;resize:vertical;font-family:Manrope,sans-serif;line-height:1.7">${escHtml(a.body||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center">
          ${isEdit ? `<button type="button" id="btn-delete-article" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Delete</button>` : ''}
          <select name="status" style="padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;font-family:'DM Mono',monospace">
            <option value="draft" ${a.status==='draft'||!a.status?'selected':''}>Draft</option>
            <option value="published" ${a.status==='published'?'selected':''}>Published</option>
          </select>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:Manrope,sans-serif;font-weight:700;font-size:13px">${isEdit?'Save':'Create Article'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Social Planner View ──────────────────────────────────────────────
function renderSocialPlanner() {
  const statuses = ['all','draft','pending_approval','approved','rejected','scheduled','published'];
  const filtered = state.socialPostFilter === 'all' ? state.socialPosts : state.socialPosts.filter(p => p.status === state.socialPostFilter);
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Social Media Planner</div>
      <div class="page-sub">${state.socialPosts.length} posts · approval workflow</div>
    </div>
    <button class="find-leads-btn" id="btn-new-social-post">+ New Post</button>
  </div>
  <div class="stage-bar" style="margin-bottom:20px">
    ${statuses.map(s => {
      const count = s==='all' ? state.socialPosts.length : state.socialPosts.filter(p=>p.status===s).length;
      const label = s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      return `<div class="stage-chip ${state.socialPostFilter===s?'active':''}" data-sp-filter="${s}">${label} (${count})</div>`;
    }).join('')}
  </div>
  <div class="rec-cands-list">
    ${filtered.map(p => {
      const statusColors = {draft:'#5a5a72',pending_approval:'#f59e0b',approved:'#10b981',rejected:'#ef4444',scheduled:'#6366f1',published:'#10b981'};
      const sc = statusColors[p.status]||'#5a5a72';
      const pendingForMe = (p.approvals||[]).find(a => a.approver_id === currentUser?.id && a.status === 'pending');
      return `
      <div class="rec-cand-card">
        <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,${sc},${sc}cc);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📱</div>
        <div class="rec-cand-body">
          <div class="rec-cand-top">
            <div style="flex:1">
              <div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${p.content}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
                ${(p.platforms||[]).map(pl => `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:4px;background:var(--accent-glow);color:var(--accent-2);border:1px solid rgba(99,102,241,0.2)">${pl}</span>`).join('')}
              </div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">
                ${p.author?.full_name||'Unknown'} · ${new Date(p.created_at).toLocaleDateString()}
                ${p.scheduled_date ? ' · 📅 '+new Date(p.scheduled_date).toLocaleDateString() : ''}
              </div>
              ${(p.approvals||[]).length ? `
                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                  ${(p.approvals||[]).map(a => `
                    <span style="font-family:'DM Mono',monospace;font-size:10px;padding:3px 8px;border-radius:4px;background:${a.status==='approved'?'var(--green-glow)':a.status==='rejected'?'var(--red-glow)':'var(--amber-glow)'};color:${a.status==='approved'?'var(--green)':a.status==='rejected'?'var(--red)':'var(--amber)'}">${a.approver?.full_name||'?'}: ${a.status}</span>
                  `).join('')}
                </div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
              <span class="cand-status-pill" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${p.status.replace(/_/g,' ')}</span>
              ${pendingForMe ? `
                <div style="display:flex;gap:4px">
                  <button data-approve-post="${pendingForMe.id}" data-post-id="${p.id}" style="padding:5px 10px;border-radius:5px;border:none;background:var(--green-glow);color:var(--green);cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;font-weight:500">✓ Approve</button>
                  <button data-reject-post="${pendingForMe.id}" data-post-id="${p.id}" style="padding:5px 10px;border-radius:5px;border:none;background:var(--red-glow);color:var(--red);cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;font-weight:500">✕ Reject</button>
                </div>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No posts yet. Click "+ New Post" to create one.</div>' : ''}
  </div>`;
}

function renderSocialPostModal() {
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <div class="modal-title">New Social Post</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="social-post-form" style="padding:20px 28px 24px">
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Post Content *</label>
          <textarea name="content" required rows="5" placeholder="Write your post..." style="width:100%;padding:12px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;resize:vertical;font-family:Manrope,sans-serif;line-height:1.7"></textarea>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Platforms</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="platform-chips">
            ${['LinkedIn','Facebook','Instagram','Twitter'].map(p => `
              <label style="font-family:'DM Mono',monospace;font-size:11px;padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px">
                <input type="checkbox" name="platforms" value="${p}" style="accent-color:var(--accent)" /> ${p}
              </label>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Schedule Date (optional)</label>
          <input type="datetime-local" name="scheduled_date" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
        </div>
        <div style="margin-bottom:16px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Requires Approval From</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="approver-chips">
            ${state.team.filter(m => m.id !== currentUser?.id).map(m => `
              <label style="font-family:'DM Mono',monospace;font-size:11px;padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;display:flex;align-items:center;gap:6px">
                <input type="checkbox" name="approvers" value="${m.id}" style="accent-color:var(--accent)" /> ${m.full_name||m.email}
              </label>`).join('')}
            ${state.team.filter(m => m.id !== currentUser?.id).length === 0 ? '<span style="font-size:11px;color:var(--text-3)">No other team members yet</span>' : ''}
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:Manrope,sans-serif;font-weight:700;font-size:13px">Create Post</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Analytics View ───────────────────────────────────────────────────
function renderAnalyticsView() {
  const d = state.analyticsData;
  if (!d) return '<div style="text-align:center;padding:60px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">Loading analytics...</div>';
  const maxDaily = Math.max(...(d.dailyData||[]).map(x=>x[1]),1);
  const avgPages = d.totalSessions?.length ? (d.totalSessions.reduce((s,x) => s + (x.pages_viewed||0), 0) / d.totalSessions.length).toFixed(1) : '0';
  const devices = {};
  (d.totalSessions||[]).forEach(s => { const dev = s.device || 'unknown'; devices[dev] = (devices[dev]||0)+1; });
  const urlParams = new URLSearchParams(location.search);
  const googleConnected = urlParams.get('google_connected') === '1' || state.googleConnected;
  const googleError = urlParams.get('google_error');

  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Website Analytics</div>
      <div class="page-sub">itimpactconsulting.us · real-time tracking</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      ${[7,14,30,90].map(n => `<button class="stage-chip ${state.analyticsDays===n?'active':''}" data-analytics-days="${n}">${n}d</button>`).join('')}
      <div style="display:flex;align-items:center;gap:6px;margin-left:8px">
        <input type="date" id="analytics-from" style="padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;font-family:'DM Mono',monospace;outline:none" />
        <span style="color:var(--text-3);font-size:11px">to</span>
        <input type="date" id="analytics-to" style="padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;font-family:'DM Mono',monospace;outline:none" />
        <button id="btn-analytics-custom" style="padding:6px 12px;border-radius:6px;border:none;background:var(--gradient-accent);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px">Go</button>
      </div>
    </div>
  </div>

  ${googleError ? `<div style="padding:12px 16px;background:var(--red-light);border-radius:8px;color:var(--red);font-size:12px;margin-bottom:16px">Google connection error: ${escHtml(googleError)}</div>` : ''}

  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:${googleConnected?'var(--green-light)':'var(--bg-1)'};border:1px solid ${googleConnected?'rgba(16,185,129,0.25)':'var(--border)'};border-radius:var(--radius);margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:22px">🔗</div>
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--text)">Google Analytics ${googleConnected ? '— Connected ✓' : '— Not Connected'}</div>
        <div style="font-size:11px;color:var(--text-3)">${googleConnected ? 'Pulling real GA4 data alongside our custom tracker' : 'Connect to see official Google Analytics data'}</div>
      </div>
    </div>
    ${!googleConnected ? `<button class="find-leads-btn" id="btn-connect-google">Connect Google</button>` : `<button id="btn-refresh-ga" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg-1);color:var(--text-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">Refresh GA Data</button>`}
  </div>

  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);${state.liveVisitors.length?'animation:livePulse 1.5s infinite':''}"></span>
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text)">Live Now — ${state.liveVisitors.length} visitor${state.liveVisitors.length===1?'':'s'}</div>
    </div>
    ${state.liveVisitors.length === 0 ? `<div style="font-size:12px;color:var(--text-3);padding:8px 0">No one online right now. Visitors appear here within 90 seconds of activity.</div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      ${state.liveVisitors.map(v => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-2);border-radius:10px;border:1px solid var(--border)">
          <span style="font-size:22px">${flagFor(v.country)}</span>
          <div style="min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${v.country || 'Unknown location'}</div>
            <div style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.device==='mobile'?'📱':'💻'} ${(v.last_page||'').replace(/^https?:\/\/[^/]+/,'')||'/'}</div>
          </div>
        </div>`).join('')}
    </div>`}
  </div>
  <style>@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>

  ${state.gaData ? `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px;margin-bottom:20px">
    <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">📊 Google Analytics — Top Pages (Last 7 Days)</div>
    ${state.gaData.error ? `<div style="color:var(--red);font-size:12px">${state.gaData.error}</div>` : `
    <table style="width:100%;font-size:12px">
      <thead><tr style="color:var(--text-3);font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase"><th style="text-align:left;padding:6px 0">Page</th><th style="text-align:right">Views</th><th style="text-align:right">Users</th><th style="text-align:right">Avg Duration</th></tr></thead>
      <tbody>
        ${(state.gaData.rows||[]).slice(0,12).map(r => `
          <tr style="border-top:1px solid var(--border-subtle)">
            <td style="padding:8px 0;color:var(--text-2)">${r.dimensionValues[0]?.value || '/'}</td>
            <td style="text-align:right;color:var(--accent);font-weight:600">${r.metricValues[0]?.value || 0}</td>
            <td style="text-align:right;color:var(--text-2)">${r.metricValues[1]?.value || 0}</td>
            <td style="text-align:right;color:var(--text-3);font-family:'DM Mono',monospace">${Math.round(r.metricValues[2]?.value || 0)}s</td>
          </tr>`).join('')}
      </tbody>
    </table>`}
  </div>` : ''}

  <div class="metrics-row" style="grid-template-columns:repeat(5,1fr)">
    <div class="metric-card"><div class="metric-label">Sessions</div><div class="metric-value">${d.sessions}</div><div class="metric-sub">unique visitors</div></div>
    <div class="metric-card"><div class="metric-label">Page Views</div><div class="metric-value accent">${d.pageViews}</div><div class="metric-sub">${avgPages} pages/session</div></div>
    <div class="metric-card"><div class="metric-label">Clicks</div><div class="metric-value green">${d.clicks}</div><div class="metric-sub">tracked interactions</div></div>
    <div class="metric-card"><div class="metric-label">Avg Time</div><div class="metric-value">${d.avgTime >= 60 ? Math.floor(d.avgTime/60)+'m '+d.avgTime%60+'s' : d.avgTime+'s'}</div><div class="metric-sub">per session</div></div>
    <div class="metric-card"><div class="metric-label">Devices</div><div class="metric-value">${devices.desktop||0}<span style="font-size:14px;color:var(--text-3)"> / </span>${devices.mobile||0}</div><div class="metric-sub">desktop / mobile</div></div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px">
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:18px">📈 Daily Page Views</div>
      ${d.dailyData?.length ? `
      <div style="display:flex;align-items:flex-end;gap:4px;height:140px">
        ${d.dailyData.map(([day, count]) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--accent-2);font-weight:600">${count}</div>
            <div style="width:100%;background:var(--gradient-accent);border-radius:6px 6px 0 0;height:${Math.max(count/maxDaily*100,6)}px;transition:height 0.5s;box-shadow:0 0 8px rgba(139,92,246,0.2)"></div>
            <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3);white-space:nowrap">${day}</div>
          </div>`).join('')}
      </div>` : '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No page view data yet</div>'}
    </div>
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:18px">🏆 Top Pages</div>
      ${d.topPages.length ? d.topPages.map((p,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${i===0?'var(--amber)':i===1?'var(--text-2)':'var(--text-3)'};width:20px;font-weight:${i<3?'700':'400'}">${i+1}.</span>
          <span style="flex:1;font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.url}</span>
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent-2);font-weight:600">${p.count}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px">No page data yet</div>'}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">🖱️ Recent Clicks</div>
      ${(d.events||[]).filter(e=>e.event_type==='click').slice(0,8).map(e => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-family:'DM Mono',monospace;font-size:10px;background:var(--accent-glow);color:var(--accent-2);padding:2px 6px;border-radius:4px">${e.element_tag||'?'}</span>
          <span style="flex:1;font-size:11px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.element_text||'(no text)'}</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${e.page_url||'/'}</span>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px">No clicks recorded yet</div>'}
    </div>
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">🕐 Recent Sessions</div>
      ${(d.totalSessions||[]).slice(0,8).map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-size:12px">${s.device==='mobile'?'📱':'💻'}</span>
          <span style="flex:1;font-size:11px;color:var(--text-2)">${s.pages_viewed||1} pages · ${s.total_time||0}s</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${new Date(s.started_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px">No sessions yet</div>'}
    </div>
  </div>`;
}

// ── AI Agents View ───────────────────────────────────────────────────
const AGENTS = [
  { id: 'marketing', name: 'Marketing Planner', icon: '📣', color: '#ec4899', desc: 'Plans LinkedIn, Instagram & Facebook content for the week' },
  { id: 'leadfinder', name: 'Lead Finder', icon: '🎯', color: '#f59e0b', desc: 'Suggests new lead targets, titles, and outreach angles' },
  { id: 'headhunter', name: 'HR Headhunter', icon: '🕵️', color: '#10b981', desc: 'Finds boolean search strings and sourcing strategy for open roles' },
  { id: 'chat', name: 'Jarvis', icon: '✨', color: '#a855f7', desc: 'Your agentic assistant — ask questions or tell it to take action (add leads, update status, start projects)' },
];

function renderAgentsView() {
  if (state.activeAgent) return renderAgentDetail();
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">AI Agents</div>
      <div class="page-sub">${hasApiKey() ? `Connected · ${getProvider()}` : 'No API key configured'}</div>
    </div>
    <button class="find-leads-btn" id="btn-agent-settings">⚙ ${hasApiKey() ? 'Manage API Key' : 'Connect API Key'}</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
    ${AGENTS.map(a => `
      <div class="rec-pos-card" style="cursor:pointer;padding:24px" data-open-agent="${a.id}">
        <div style="width:52px;height:52px;border-radius:14px;background:${a.color}22;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px">${a.icon}</div>
        <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:17px;color:var(--text);margin-bottom:6px">${a.name}</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.6">${a.desc}</div>
        <div style="margin-top:14px;font-family:'DM Mono',monospace;font-size:11px;color:${a.color};font-weight:600">Open Agent →</div>
      </div>`).join('')}
  </div>`;
}

function renderAgentDetail() {
  const a = AGENTS.find(x => x.id === state.activeAgent);
  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <button id="btn-back-agents" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text-3);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">← Back</button>
      <div class="page-title">${a.icon} ${a.name}</div>
    </div>
    <div class="page-sub">${a.desc}</div>
  </div>

  ${!hasApiKey() ? `
  <div style="padding:24px;background:var(--amber-light);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius);margin-bottom:20px">
    <div style="font-weight:700;font-size:14px;color:#b45309;margin-bottom:8px">No API Key Connected</div>
    <div style="font-size:13px;color:var(--text-2);margin-bottom:14px">This agent needs an OpenAI or Anthropic API key to run. Your key is stored only in your browser.</div>
    <button class="find-leads-btn" id="btn-agent-settings-2">Connect API Key</button>
  </div>` : ''}

  ${a.id === 'chat' ? renderChatAgentUI() : renderTaskAgentUI(a)}
  `;
}

function renderTaskAgentUI(a) {
  return `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow-card)">
    <label style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:10px">
      ${a.id==='marketing' ? 'Context (audience, focus, recent wins, etc.)' : a.id==='leadfinder' ? 'Target context (industry, ICP details)' : 'Position details (title, requirements, seniority)'}
    </label>
    <textarea id="agent-input" rows="4" placeholder="${a.id==='marketing' ? 'e.g. Focus on our new AI engineering recruiting service, target healthcare and PE clients' : a.id==='leadfinder' ? 'e.g. Mid-size PE-backed healthcare companies, 50-200 employees' : 'e.g. Senior AI Engineer, remote, requires LangChain + production LLM experience'}" style="width:100%;padding:14px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none;resize:vertical;font-family:Manrope,sans-serif;margin-bottom:16px">${escHtml(state.agentInput)}</textarea>
    <button id="btn-run-agent" class="find-leads-btn" ${state.agentLoading?'disabled':''} style="background:${a.color}">
      ${state.agentLoading ? '⏳ Thinking...' : '✨ Run Agent'}
    </button>
    ${state.agentError ? `<div style="margin-top:14px;padding:12px 16px;background:var(--red-light);border-radius:8px;color:var(--red);font-size:12px">${state.agentError}</div>` : ''}
  </div>
  ${state.agentOutput ? `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-top:16px;box-shadow:var(--shadow-card)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:14px;color:var(--text)">Output</div>
      <button class="copy-btn" id="btn-copy-agent-output">Copy</button>
    </div>
    <div style="font-size:13px;color:var(--text-2);line-height:1.8;white-space:pre-wrap">${escHtml(state.agentOutput)}</div>
  </div>` : ''}`;
}

function renderChatAgentUI() {
  return `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;height:calc(100vh - 320px);box-shadow:var(--shadow-card)">
    <div id="chat-agent-messages" style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:14px">
      ${state.chatHistory.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:13px">Ask me anything about your leads, pipeline, projects, or team.</div>' : ''}
      ${state.chatHistory.map(m => `
        <div style="display:flex;${m.role==='user'?'justify-content:flex-end':''}">
          <div style="max-width:75%;padding:12px 16px;border-radius:14px;background:${m.role==='user'?'var(--accent)':'var(--bg-2)'};color:${m.role==='user'?'#fff':'var(--text)'};font-size:13px;line-height:1.7;white-space:pre-wrap">${escHtml(m.content)}</div>
        </div>`).join('')}
      ${state.agentLoading ? '<div style="color:var(--text-3);font-size:12px;font-family:DM Mono,monospace">Thinking...</div>' : ''}
    </div>
    <form id="chat-agent-form" style="padding:14px 18px;border-top:1px solid var(--border);display:flex;gap:8px">
      <input type="text" name="question" placeholder="Ask about your CRM data..." autocomplete="off" style="flex:1;padding:11px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none" />
      <button type="submit" class="find-leads-btn" ${state.agentLoading?'disabled':''}>Send</button>
    </form>
  </div>`;
}

function renderApiKeyModal() {
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <div class="modal-title">Connect AI Provider</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="api-key-form" style="padding:20px 28px 24px">
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Provider</label>
          <select name="provider" style="width:100%;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none">
            <option value="openai" ${getProvider()==='openai'?'selected':''}>OpenAI (GPT-4o-mini)</option>
            <option value="anthropic" ${getProvider()==='anthropic'?'selected':''}>Anthropic (Claude Sonnet)</option>
          </select>
        </div>
        <div style="margin-bottom:8px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">API Key</label>
          <input type="password" name="apiKey" value="${getApiKey()}" placeholder="sk-..." style="width:100%;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;font-family:'DM Mono',monospace" />
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:18px;line-height:1.6">
          Get a key at <strong>platform.openai.com/api-keys</strong> or <strong>console.anthropic.com</strong>. Stored only in your browser's local storage — never sent to our servers.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          ${hasApiKey() ? `<button type="button" id="btn-clear-key" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.25);background:var(--red-light);color:var(--red);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Remove Key</button>` : ''}
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Cancel</button>
          <button type="submit" class="find-leads-btn" style="padding:9px 20px">Save</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Relationship Map View ───────────────────────────────────────────
function renderMapView() {
  const { nodes, edges } = { nodes: state.mapNodes, edges: state.mapEdges };
  const W = 1100, H = 640;
  const byType = {};
  nodes.forEach(n => { (byType[n.type] = byType[n.type] || []).push(n); });
  const types = Object.keys(byType);
  const positions = state.mapPositions;

  types.forEach((type, ti) => {
    const list = byType[type];
    const colX = (ti + 0.5) / types.length * W;
    list.forEach((n, i) => {
      if (!positions[n.id]) {
        positions[n.id] = { x: colX + (Math.random()-0.5)*80, y: (i + 0.5) / list.length * H + (Math.random()-0.5)*20 };
      }
    });
  });

  const selected = state.mapSelectedNode ? nodes.find(n => n.id === state.mapSelectedNode) : null;

  return `
  <div class="page-header">
    <div class="page-title">Relationship Map</div>
    <div class="page-sub">${nodes.length} nodes · ${edges.length} connections — drag nodes, click to inspect</div>
  </div>
  <div style="display:grid;grid-template-columns:${selected ? '1fr 320px' : '1fr'};gap:16px">
    <div style="background:radial-gradient(ellipse at center, #161229 0%, #0c0a18 100%);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card);position:relative">
      <svg id="map-svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:640px;display:block;cursor:grab">
        <defs>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#a855f7" stop-opacity="0.1" />
            <stop offset="50%" stop-color="#22d3ee" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#a855f7" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        <g id="map-stars">
          ${Array.from({length:40}).map(() => `<circle cx="${Math.random()*W}" cy="${Math.random()*H}" r="${Math.random()*1.2}" fill="#fff" opacity="${0.15+Math.random()*0.25}"><animate attributeName="opacity" values="${0.1};${0.4};${0.1}" dur="${2+Math.random()*3}s" repeatCount="indefinite" /></circle>`).join('')}
        </g>
        <g id="map-edges">
          ${edges.map((e,i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return '';
            return `<line data-edge-i="${i}" x1="${f.x}" y1="${f.y}" x2="${t.x}" y2="${t.y}" stroke="url(#edge-grad)" stroke-width="1.5">
              <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="${2.5+Math.random()*2}s" repeatCount="indefinite" />
            </line>`;
          }).join('')}
        </g>
        <g id="map-nodes">
          ${nodes.map(n => {
            const p = positions[n.id] || { x: W/2, y: H/2 };
            const r = 14 * (n.size || 1);
            const isSelected = state.mapSelectedNode === n.id;
            const dur = (3 + Math.random()*2.5).toFixed(2);
            return `
            <g class="map-node" data-node-id="${n.id}" style="cursor:pointer" transform="translate(${p.x},${p.y})">
              <animateTransform attributeName="transform" type="translate" additive="sum" values="0,0; ${(Math.random()*8-4).toFixed(1)},${(Math.random()*8-4).toFixed(1)}; 0,0" dur="${dur}s" repeatCount="indefinite" />
              <circle r="${r+5}" fill="${n.color}" opacity="0.18" filter="url(#node-glow)">
                <animate attributeName="r" values="${r+3};${r+9};${r+3}" dur="${(2+Math.random()).toFixed(2)}s" repeatCount="indefinite" />
              </circle>
              <circle r="${r}" fill="${n.color}" opacity="${isSelected?1:0.92}" stroke="${isSelected?'#fff':'rgba(255,255,255,0.3)'}" stroke-width="${isSelected?3:1}" filter="url(#node-glow)" />
              <text y="${r + 17}" text-anchor="middle" font-size="11" font-family="DM Mono, monospace" fill="#cfc8ee">${escHtml((n.label||'').substring(0,18))}</text>
            </g>`;
          }).join('')}
        </g>
      </svg>
      <div style="position:absolute;bottom:16px;left:16px;display:flex;gap:10px;flex-wrap:wrap;background:rgba(15,12,30,0.85);backdrop-filter:blur(8px);padding:8px 12px;border-radius:8px;border:1px solid var(--glass-border)">
        ${Object.entries(NODE_TYPE_LABELS).map(([type, label]) => {
          const colorMap = { lead:'#f59e0b', project:'#3b82f6', team:'#a855f7', position:'#10b981', candidate:'#ec4899' };
          return `<div style="display:flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;font-size:10px;color:#cfc8ee"><span style="width:8px;height:8px;border-radius:50%;background:${colorMap[type]};display:inline-block;box-shadow:0 0 6px ${colorMap[type]}"></span>${label}</div>`;
        }).join('')}
      </div>
    </div>
    ${selected ? `
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-card)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <span style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;color:${selected.color}">${NODE_TYPE_LABELS[selected.type]}</span>
        <button id="btn-close-node-panel" style="background:var(--bg-2);border:1px solid var(--border);border-radius:6px;width:24px;height:24px;cursor:pointer;color:var(--text-3)">✕</button>
      </div>
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:17px;color:var(--text);margin-bottom:6px">${selected.label}</div>
      <div style="font-size:13px;color:var(--text-2)">${selected.sub||''}</div>
    </div>` : ''}
  </div>`;
}

// ── Website Submissions Views ───────────────────────────────────────
function submissionCard(s, opts) {
  const { typeLabel, typeIcon, statusOptions, statusField='status', extraFields=[], idPrefix } = opts;
  const isExpanded = state.expandedSubmission === idPrefix + s.id;
  const st = statusOptions.find(o => o.id === s[statusField]) || statusOptions[0];
  return `
  <div class="rec-cand-card" style="flex-direction:column;gap:0;cursor:pointer" data-toggle-submission="${idPrefix}${s.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
      <div style="display:flex;gap:14px;flex:1;min-width:0">
        <div class="rec-cand-avatar">${(s.full_name||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px;color:var(--text)">${s.full_name}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:2px">${s.email} ${s.phone?' · '+s.phone:''}</div>
          ${extraFields.map(f => s[f.key] ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${f.label}: ${s[f.key]}</div>` : '').join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <span class="cand-status-pill" style="background:${st.color}1a;color:${st.color};border:1px solid ${st.color}33">${st.label}</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${new Date(s.created_at).toLocaleDateString()} ${new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
      </div>
    </div>
    ${isExpanded ? `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)" onclick="event.stopPropagation()">
      ${opts.renderDetail ? opts.renderDetail(s) : ''}
      <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap">
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase">Status:</span>
        <select class="cand-status-select" data-submission-status="${idPrefix}${s.id}" data-submission-table="${opts.table}">
          ${statusOptions.map(o=>`<option value="${o.id}" ${s[statusField]===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>
    </div>` : ''}
  </div>`;
}

const CONTACT_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'contacted',label:'Contacted',color:'#6366f1'},{id:'closed',label:'Closed',color:'#10b981'}];
const CV_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'reviewing',label:'Reviewing',color:'#6366f1'},{id:'shortlisted',label:'Shortlisted',color:'#10b981'},{id:'rejected',label:'Rejected',color:'#ef4444'}];
const JOBAPP_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'reviewing',label:'Reviewing',color:'#6366f1'},{id:'shortlisted',label:'Shortlisted',color:'#8b5cf6'},{id:'interviewing',label:'Interviewing',color:'#06b6d4'},{id:'hired',label:'Hired',color:'#10b981'},{id:'rejected',label:'Rejected',color:'#ef4444'}];
const AI_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'contacted',label:'Contacted',color:'#6366f1'},{id:'qualified',label:'Qualified',color:'#10b981'},{id:'closed',label:'Closed',color:'#94a3b8'}];

function renderContactSubmissions() {
  const items = state.contactSubmissions;
  return `
  <div class="page-header">
    <div class="page-title">Contact Submissions</div>
    <div class="page-sub">${items.length} inquiries from the website contact form</div>
  </div>
  <div class="rec-cands-list">
    ${items.length === 0 ? '<div class="social-empty">No contact form submissions yet.</div>' : ''}
    ${items.map(s => submissionCard(s, {
      table: 'contact_submissions', idPrefix: 'contact-', statusOptions: CONTACT_STATUSES,
      extraFields: [{key:'company',label:'Company'}],
      renderDetail: (s) => `
        ${s.service_interest?.length ? `<div style="margin-bottom:10px"><span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase">Interested in:</span> <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${s.service_interest.map(i=>`<span class="rec-tag">${i}</span>`).join('')}</div></div>` : ''}
        ${s.message ? `<div style="font-size:13px;color:var(--text-2);line-height:1.7;background:var(--bg-2);padding:12px 14px;border-radius:8px">${s.message}</div>` : ''}
      `,
    })).join('')}
  </div>`;
}

function renderGeneralCVs() {
  const items = state.generalCVs;
  return `
  <div class="page-header">
    <div class="page-title">General CVs</div>
    <div class="page-sub">${items.length} open applications (no specific role)</div>
  </div>
  <div class="rec-cands-list">
    ${items.length === 0 ? '<div class="social-empty">No general CV submissions yet.</div>' : ''}
    ${items.map(s => submissionCard(s, {
      table: 'general_cv_submissions', idPrefix: 'cv-', statusOptions: CV_STATUSES,
      extraFields: [{key:'current_title',label:'Current Role'},{key:'current_company',label:'Company'},{key:'location',label:'Location'}],
      renderDetail: (s) => `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${s.linkedin_url ? `<a href="${s.linkedin_url}" target="_blank" class="rec-cv-link">🔗 LinkedIn Profile</a>` : ''}
          ${s.resume_url ? `<a href="${s.resume_url}" target="_blank" class="rec-cv-link">📄 View Resume</a>` : ''}
        </div>
      `,
    })).join('')}
  </div>`;
}

function renderJobApplications() {
  const filtered = state.jobAppFilter === 'all' ? state.jobApplications : state.jobApplications.filter(j => j.position_title === state.jobAppFilter);
  const positions = [...new Set(state.jobApplications.map(j => j.position_title))];
  return `
  <div class="page-header">
    <div class="page-title">Job Applications</div>
    <div class="page-sub">${state.jobApplications.length} applications for specific roles</div>
  </div>
  <div class="stage-bar">
    <div class="stage-chip ${state.jobAppFilter==='all'?'active':''}" data-jobapp-filter="all">All (${state.jobApplications.length})</div>
    ${positions.map(p => `<div class="stage-chip ${state.jobAppFilter===p?'active':''}" data-jobapp-filter="${p}">${p} (${state.jobApplications.filter(j=>j.position_title===p).length})</div>`).join('')}
  </div>
  <div class="rec-cands-list">
    ${filtered.length === 0 ? '<div class="social-empty">No job applications yet.</div>' : ''}
    ${filtered.map(s => submissionCard(s, {
      table: 'job_applications', idPrefix: 'job-', statusOptions: JOBAPP_STATUSES,
      extraFields: [{key:'position_title',label:'Applied for'},{key:'current_title',label:'Current Role'},{key:'location',label:'Location'},{key:'expected_salary',label:'Expected Salary'}],
      renderDetail: (s) => `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;font-size:12px;color:var(--text-2)">
          <div>Employment: <strong>${s.employment_status||'—'}</strong></div>
          <div>Current Salary: <strong>${s.current_salary||'—'}</strong></div>
          <div>Open to Relocation: <strong>${s.open_to_relocation||'—'}</strong></div>
          <div>Open to Remote: <strong>${s.open_to_remote||'—'}</strong></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${s.linkedin_url ? `<a href="${s.linkedin_url}" target="_blank" class="rec-cv-link">🔗 LinkedIn Profile</a>` : ''}
          ${s.resume_url ? `<a href="${s.resume_url}" target="_blank" class="rec-cv-link">📄 View Resume</a>` : ''}
        </div>
      `,
    })).join('')}
  </div>`;
}

function renderAIAssessments() {
  const items = state.aiAssessments;
  const avgScore = items.length ? (items.reduce((s,a)=>s+(a.overall_score||0),0)/items.length).toFixed(1) : 0;
  return `
  <div class="page-header">
    <div class="page-title">AI Readiness Assessments</div>
    <div class="page-sub">${items.length} completed · avg score ${avgScore}</div>
  </div>
  <div class="rec-cands-list">
    ${items.length === 0 ? '<div class="social-empty">No AI assessment submissions yet.</div>' : ''}
    ${items.map(s => submissionCard(s, {
      table: 'ai_assessments', idPrefix: 'ai-', statusOptions: AI_STATUSES,
      extraFields: [{key:'company',label:'Company'},{key:'overall_grade',label:'Grade'}],
      renderDetail: (s) => `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:32px;color:var(--accent)">${s.overall_score||0}</div>
          <div style="font-size:13px;color:var(--text-2)">Overall Score ${s.overall_grade?'· Grade '+s.overall_grade:''}</div>
        </div>
        ${s.category_scores && Object.keys(s.category_scores).length ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${Object.entries(s.category_scores).map(([cat,score]) => `
            <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-2);border-radius:6px;font-size:12px">
              <span style="color:var(--text-2)">${cat}</span><span style="font-weight:700;color:var(--accent)">${score}</span>
            </div>`).join('')}
        </div>` : ''}
      `,
    })).join('')}
  </div>`;
}

// ── Notification Panel ───────────────────────────────────────────────
function renderNotifPanel() {
  if (!state.showNotifPanel) return '';
  return `
  <div id="notif-panel" style="position:fixed;top:0;right:0;width:360px;height:100vh;background:var(--bg-1);border-left:1px solid var(--border);z-index:200;display:flex;flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,0.4);animation:slideIn 0.2s ease">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)">
      <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:16px;color:var(--text)">Notifications</div>
      <div style="display:flex;gap:8px">
        <button id="btn-mark-all-read" style="font-family:'DM Mono',monospace;font-size:10px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer">Mark all read</button>
        <button id="btn-close-notif" style="font-family:'DM Mono',monospace;font-size:12px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer">✕</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px">
      ${state.notifications.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No notifications yet</div>' : ''}
      ${state.notifications.map(n => `
        <div style="padding:12px 14px;border-radius:8px;margin-bottom:4px;background:${n.read?'transparent':'var(--accent-glow)'};cursor:pointer;transition:background 0.15s" data-notif-id="${n.id}" data-notif-link="${n.link||''}">
          <div style="font-size:12px;font-weight:${n.read?'400':'600'};color:var(--text);margin-bottom:3px">${n.title}</div>
          <div style="font-size:11px;color:var(--text-2);line-height:1.5">${n.body||''}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:4px">${timeAgo(n.created_at)}</div>
        </div>`).join('')}
    </div>
  </div>
  <style>@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}</style>`;
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

// ── Auth Screen ──────────────────────────────────────────────────────
function renderAuthScreen() {
  const isLogin = state.authView === 'login';
  return `
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg);padding:20px">
    <div style="width:100%;max-width:400px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.5px;margin-bottom:6px">IT<span style="color:var(--accent-2)">Impact</span></div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em">CRM & Project Management</div>
      </div>
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:16px;padding:28px 32px">
        <div style="display:flex;gap:0;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
          <button class="auth-tab ${isLogin?'active':''}" data-authview="login" style="flex:1;padding:10px;border:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px;background:${isLogin?'var(--accent-glow)':'var(--bg-3)'};color:${isLogin?'var(--accent-2)':'var(--text-3)'};transition:all 0.15s">Sign In</button>
          <button class="auth-tab ${!isLogin?'active':''}" data-authview="signup" style="flex:1;padding:10px;border:none;border-left:1px solid var(--border);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px;background:${!isLogin?'var(--accent-glow)':'var(--bg-3)'};color:${!isLogin?'var(--accent-2)':'var(--text-3)'};transition:all 0.15s">Sign Up</button>
        </div>
        ${state.authError ? `<div style="padding:10px 12px;background:var(--red-glow);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:12px;color:var(--red);font-family:'DM Mono',monospace;margin-bottom:16px">${state.authError}</div>` : ''}
        <form id="auth-form">
          ${!isLogin ? `
          <div style="margin-bottom:14px">
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Full Name</label>
            <input type="text" name="fullName" required style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;font-family:Manrope,sans-serif" placeholder="Amish Mirza" />
          </div>` : ''}
          <div style="margin-bottom:14px">
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Email</label>
            <input type="email" name="email" required style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;font-family:Manrope,sans-serif" placeholder="you@itimpact.com" />
          </div>
          <div style="margin-bottom:20px">
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Password</label>
            <input type="password" name="password" required minlength="6" style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;font-family:Manrope,sans-serif" placeholder="••••••••" />
          </div>
          <button type="submit" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;border:none;border-radius:8px;font-family:Manrope,sans-serif;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 2px 12px rgba(99,102,241,0.3);transition:all 0.15s" ${state.authLoading?'disabled':''}>
            ${state.authLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  </div>`;
}

// ── Leads View ───────────────────────────────────────────────────────
function renderLeads() {
  const statusCounts = {};
  LEAD_STATUSES.forEach(s => { statusCounts[s.id] = state.leads.filter(l => l.status === s.id).length; });
  const filtered = state.leadFilter === 'all' ? state.leads : state.leads.filter(l => l.status === state.leadFilter);
  const totalValue = state.leads.reduce((s, l) => s + (l.value || 0), 0);

  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Leads</div>
      <div class="page-sub">${state.leads.length} leads · $${totalValue.toLocaleString()} total value</div>
    </div>
    <button class="find-leads-btn" id="btn-new-lead">+ New Lead</button>
  </div>

  <div class="metrics-row" style="grid-template-columns:repeat(${LEAD_STATUSES.length},1fr)">
    ${LEAD_STATUSES.map(s => `
      <div class="metric-card" style="cursor:pointer;${state.leadFilter===s.id?'border-color:'+s.color:''}" data-lead-filter="${s.id}">
        <div class="metric-label">${s.label}</div>
        <div class="metric-value" style="color:${s.color}">${statusCounts[s.id]||0}</div>
      </div>`).join('')}
  </div>

  <div class="stage-bar" style="margin-bottom:20px">
    <div class="stage-chip ${state.leadFilter==='all'?'active':''}" data-lead-filter="all">All (${state.leads.length})</div>
    ${LEAD_STATUSES.map(s=>`<div class="stage-chip ${state.leadFilter===s.id?'active':''}" data-lead-filter="${s.id}">${s.label} (${statusCounts[s.id]||0})</div>`).join('')}
  </div>

  ${state.leadsLoading ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">Loading leads...</div>' : ''}

  <div class="rec-cands-list">
    ${filtered.length === 0 && !state.leadsLoading ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No leads yet. Click "+ New Lead" to add one.</div>' : ''}
    ${filtered.map(l => {
      const st = LEAD_STATUSES.find(s=>s.id===l.status) || LEAD_STATUSES[0];
      return `
      <div class="rec-cand-card" style="cursor:pointer" data-edit-lead="${l.id}">
        <div class="rec-cand-avatar" style="background:linear-gradient(135deg,${st.color},${st.color}cc)">${(l.name||'?')[0].toUpperCase()}</div>
        <div class="rec-cand-body">
          <div class="rec-cand-top">
            <div>
              <div class="rec-cand-name">${l.name}</div>
              <div class="rec-cand-role">${l.company||'No company'}${l.email?' · '+l.email:''}</div>
              ${l.value ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green);margin-top:2px">$${l.value.toLocaleString()}</div>` : ''}
            </div>
            <div class="rec-cand-actions">
              <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
              <select class="cand-status-select" data-lead-status="${l.id}" onclick="event.stopPropagation()">
                ${LEAD_STATUSES.map(s=>`<option value="${s.id}" ${l.status===s.id?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${l.notes ? `<div class="rec-cand-summary">${l.notes}</div>` : ''}
          <div style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace;margin-top:4px">
            ${l.source||'manual'} · ${new Date(l.created_at).toLocaleDateString()}
            ${l.assigned?.full_name ? ' · → '+l.assigned.full_name : ''}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderLeadModal() {
  const isEdit = !!state.leadEditData?.id;
  const l = state.leadEditData || {};
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:520px">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Lead' : 'New Lead'}</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="lead-form" style="padding:20px 28px 24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Name *</label>
            <input type="text" name="name" required value="${escHtml(l.name||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Company</label>
            <input type="text" name="company" value="${escHtml(l.company||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Email</label>
            <input type="email" name="email" value="${escHtml(l.email||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Phone</label>
            <input type="text" name="phone" value="${escHtml(l.phone||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Value ($)</label>
            <input type="number" name="value" value="${l.value||0}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Source</label>
            <input type="text" name="source" value="${escHtml(l.source||'manual')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Notes</label>
          <textarea name="notes" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;min-height:80px;resize:vertical;font-family:Manrope,sans-serif">${escHtml(l.notes||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          ${isEdit ? `<button type="button" id="btn-delete-lead" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Delete</button>` : ''}
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:Manrope,sans-serif;font-weight:700;font-size:13px">${isEdit?'Save Changes':'Add Lead'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Projects View ────────────────────────────────────────────────────
function renderProjects() {
  if (state.activeProject) return renderProjectDetail();

  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Projects</div>
      <div class="page-sub">${state.projects.length} projects</div>
    </div>
    <button class="find-leads-btn" id="btn-new-project">+ New Project</button>
  </div>

  ${state.projectsLoading ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">Loading projects...</div>' : ''}

  <div class="rec-positions-grid">
    ${state.projects.length === 0 && !state.projectsLoading ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No projects yet. Click "+ New Project" to create one.</div>' : ''}
    ${state.projects.map(p => `
      <div class="rec-pos-card" style="cursor:pointer" data-open-project="${p.id}">
        <div class="rec-pos-header">
          <div class="rec-pos-left">
            <div class="rec-pos-title">${p.name}</div>
            <div class="rec-pos-meta">${p.description||'No description'} · Created ${new Date(p.created_at).toLocaleDateString()}</div>
          </div>
          <div class="rec-pos-badges">
            <span class="rec-pos-badge active">${p.status}</span>
            <span class="rec-chevron">→</span>
          </div>
        </div>
      </div>`).join('')}
  </div>`;
}

function renderProjectDetail() {
  const p = state.activeProject;
  const tabs = [
    {id:'board', label:'Message Board', icon:'💬'},
    {id:'todos', label:'To-dos', icon:'✓'},
    {id:'schedule', label:'Schedule', icon:'📅'},
    {id:'chat', label:'Campfire', icon:'🔥'},
    {id:'checkins', label:'Check-ins', icon:'❓'},
  ];

  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <button id="btn-back-projects" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">← Back</button>
      <div class="page-title">${p.name}</div>
    </div>
    <div class="page-sub">${p.description||''}</div>
  </div>

  <div class="rec-tabs" style="margin-top:0">
    ${tabs.map(t=>`<button class="rec-tab ${state.projectTab===t.id?'active':''}" data-ptab="${t.id}">${t.icon} ${t.label}</button>`).join('')}
  </div>

  <div id="project-tab-content">
    ${state.projectTab==='board' ? renderMessageBoard() : ''}
    ${state.projectTab==='todos' ? renderTodos() : ''}
    ${state.projectTab==='schedule' ? renderSchedule() : ''}
    ${state.projectTab==='chat' ? renderChat() : ''}
    ${state.projectTab==='checkins' ? renderCheckinView() : ''}
  </div>`;
}

function renderMessageBoard() {
  return `
  <div style="margin-bottom:20px">
    <form id="new-message-form" style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
      <input type="text" name="title" placeholder="Message title..." required style="width:100%;padding:10px 0;background:transparent;border:none;color:var(--text);font-size:15px;font-weight:500;outline:none;font-family:Manrope,sans-serif;border-bottom:1px solid var(--border);margin-bottom:12px" />
      <textarea name="body" placeholder="Write your message..." rows="3" style="width:100%;padding:8px 0;background:transparent;border:none;color:var(--text-2);font-size:13px;outline:none;resize:vertical;font-family:Manrope,sans-serif;min-height:60px"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button type="submit" style="padding:8px 18px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Post Message</button>
      </div>
    </form>
  </div>
  ${state.projectMessages.map(m => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div style="padding:16px 20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,var(--accent),#4f46e5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;font-family:Manrope,sans-serif">${(m.author?.full_name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:12px;font-weight:500;color:var(--text)">${m.author?.full_name||'Unknown'}</div>
            <div style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace">${new Date(m.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:8px">${m.title}</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7;white-space:pre-wrap">${m.body||''}</div>
      </div>
    </div>`).join('')}
  ${state.projectMessages.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No messages yet. Post the first one above.</div>' : ''}`;
}

function renderTodos() {
  return `
  <div style="margin-bottom:16px">
    <form id="new-todolist-form" style="display:flex;gap:8px">
      <input type="text" name="listName" placeholder="New to-do list name..." required style="flex:1;padding:10px 14px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none" />
      <button type="submit" style="padding:10px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px;white-space:nowrap">+ Add List</button>
    </form>
  </div>
  ${state.projectTodoLists.map(list => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div class="outreach-prospect-header">
        <div class="outreach-prospect-name">${list.name}</div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3)">${(list.todos||[]).filter(t=>t.completed).length}/${(list.todos||[]).length} done</span>
      </div>
      <div style="padding:12px 20px">
        ${(list.todos||[]).map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)" data-todo-id="${t.id}">
            <input type="checkbox" ${t.completed?'checked':''} data-toggle-todo="${t.id}" style="accent-color:var(--accent);cursor:pointer" />
            <span style="flex:1;font-size:13px;color:${t.completed?'var(--text-3)':'var(--text)'};${t.completed?'text-decoration:line-through':''}">${t.title}</span>
            ${t.assignee?.full_name ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--accent-2);background:var(--accent-glow);padding:2px 8px;border-radius:4px">${t.assignee.full_name}</span>` : ''}
            ${t.due_date ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--amber)">${t.due_date}</span>` : ''}
            <button data-delete-todo="${t.id}" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:12px;padding:2px 4px" title="Delete">✕</button>
          </div>`).join('')}
        <form class="add-todo-form" data-list-id="${list.id}" style="display:flex;gap:8px;margin-top:10px">
          <input type="text" name="title" placeholder="Add a to-do..." required style="flex:1;padding:8px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
          <button type="submit" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--accent-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">Add</button>
        </form>
      </div>
    </div>`).join('')}
  ${state.projectTodoLists.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No to-do lists yet. Create one above.</div>' : ''}`;
}

function renderSchedule() {
  return `
  <form id="new-event-form" style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:20px">
    <div style="display:grid;grid-template-columns:1fr 120px 100px;gap:10px;align-items:end">
      <div>
        <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Event Title</label>
        <input type="text" name="title" required placeholder="Meeting, deadline, milestone..." style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
      </div>
      <div>
        <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Date</label>
        <input type="date" name="date" required style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
      </div>
      <button type="submit" style="padding:9px 14px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Add</button>
    </div>
  </form>
  ${state.projectEvents.map(e => {
    const d = new Date(e.event_date);
    const isPast = d < new Date();
    return `
    <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border-subtle)">
      <div style="min-width:48px;text-align:center">
        <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:20px;color:${isPast?'var(--text-3)':'var(--accent-2)'};line-height:1">${d.getDate()}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase">${d.toLocaleString('en',{month:'short'})}</div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:500;color:${isPast?'var(--text-3)':'var(--text)'}">${e.title}</div>
        ${e.description ? `<div style="font-size:12px;color:var(--text-2);margin-top:2px">${e.description}</div>` : ''}
      </div>
    </div>`;
  }).join('')}
  ${state.projectEvents.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No events scheduled. Add one above.</div>' : ''}`;
}

function renderChat() {
  return `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;height:calc(100vh - 280px)">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);font-family:Manrope,sans-serif;font-weight:700;font-size:14px;color:var(--text)">🔥 Campfire</div>
    <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px">
      ${state.projectChat.map(m => {
        const isMe = m.author_id === currentUser?.id;
        return `
        <div style="display:flex;gap:10px;align-items:flex-start;${isMe?'flex-direction:row-reverse':''}">
          <div style="width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,${isMe?'var(--green)':'var(--accent)'},${isMe?'#059669':'#4f46e5'});display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;font-family:Manrope,sans-serif;flex-shrink:0">${(m.author?.full_name||'?')[0].toUpperCase()}</div>
          <div style="max-width:70%;${isMe?'text-align:right':''}">
            <div style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace;margin-bottom:3px">${m.author?.full_name||'Unknown'} · ${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            <div style="padding:10px 14px;border-radius:10px;background:${isMe?'var(--accent-glow)':'var(--bg-3)'};font-size:13px;color:var(--text-2);line-height:1.6;display:inline-block;text-align:left">${m.body}</div>
          </div>
        </div>`;
      }).join('')}
      ${state.projectChat.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No messages yet. Start the conversation!</div>' : ''}
    </div>
    <form id="chat-form" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">
      <input type="text" name="message" placeholder="Type a message..." required autocomplete="off" style="flex:1;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none" />
      <button type="submit" style="padding:10px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Send</button>
    </form>
  </div>`;
}

function renderCheckinView() {
  return `
  <form id="new-checkin-form" style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:20px">
    <div style="display:grid;grid-template-columns:1fr 120px 80px;gap:10px;align-items:end">
      <div>
        <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Check-in Question</label>
        <input type="text" name="question" required placeholder="What did you work on today?" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
      </div>
      <div>
        <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Frequency</label>
        <select name="frequency" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <button type="submit" style="padding:9px 14px;border-radius:6px;border:none;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px">Add</button>
    </div>
  </form>
  ${state.projectCheckins.map(c => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div class="outreach-prospect-header">
        <div>
          <div class="outreach-prospect-name">❓ ${c.question}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:2px">${c.frequency} · ${(c.responses||[]).length} responses</div>
        </div>
      </div>
      <div style="padding:12px 20px">
        ${(c.responses||[]).slice(0,5).map(r => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="font-size:12px;font-weight:500;color:var(--text)">${r.author?.full_name||'Unknown'}</span>
              <span style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace">${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <div style="font-size:12px;color:var(--text-2);line-height:1.6">${r.body}</div>
          </div>`).join('')}
        <form class="checkin-respond-form" data-checkin-id="${c.id}" style="display:flex;gap:8px;margin-top:10px">
          <input type="text" name="response" placeholder="Your response..." required style="flex:1;padding:8px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
          <button type="submit" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--accent-2);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">Reply</button>
        </form>
      </div>
    </div>`).join('')}
  ${state.projectCheckins.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No check-ins yet. Create one above.</div>' : ''}`;
}

// ── Render Helpers ────────────────────────────────────────────────────
function bantBarHTML(bant) {
  const groups = [{k:'b',v:bant.b,c:'filled-b'},{k:'a',v:bant.a,c:'filled-a'},{k:'n',v:bant.n,c:'filled-n'},{k:'t',v:bant.t,c:'filled-t'}];
  return '<div class="bant-bar">' + groups.map((g,i) =>
    Array.from({length:5},(_,j)=>`<div class="bant-seg ${j<g.v?g.cls:''}"></div>`).join('') +
    (i<3?'<div class="bant-divider"></div>':'')
  ).join('') + '</div>';
}

function stagePillHTML(s) {
  return `<span class="stage-pill stage-${s}">${STAGES[s]}</span>`;
}

function sourceBadge(src) {
  if (!src) return '';
  return src === 'Apollo Agent'
    ? `<span class="source-badge apollo">⚡ Apollo</span>`
    : `<span class="source-badge manual">Manual</span>`;
}

// ── Sidebar ───────────────────────────────────────────────────────────
function renderSidebar() {
  const navItems = [
    {id:'leads',          icon:'⚡', label:'Leads', section:'crm'},
    {id:'projects',       icon:'▣', label:'Projects', section:'crm'},
    {id:'team',           icon:'◉', label:'Team', section:'crm'},
    {id:'social-planner', icon:'📋', label:'Social Planner', section:'crm'},
    {id:'articles',       icon:'📝', label:'Articles', section:'crm'},
    {id:'analytics',      icon:'📊', label:'Analytics', section:'crm'},
    {id:'agents',         icon:'🤖', label:'AI Agents', section:'crm'},
    {id:'map',            icon:'🕸️', label:'Relationship Map', section:'crm'},
    {id:'contact-subs',   icon:'✉️', label:'Contact Submissions', section:'website'},
    {id:'general-cvs',    icon:'📄', label:'General CVs', section:'website'},
    {id:'job-apps',       icon:'💼', label:'Job Applications', section:'website'},
    {id:'ai-assessments', icon:'🧠', label:'AI Assessments', section:'website'},
    {id:'pipeline',       icon:'◈', label:'Pipeline', section:'sales'},
    {id:'recruiting',     icon:'⬡', label:'Recruiting', section:'sales'},
    {id:'social',         icon:'✦', label:'Content Engine', section:'tools'},
    {id:'icp',            icon:'◎', label:'ICP & Triggers', section:'tools'},
    {id:'disqualify',     icon:'✕', label:'Disqualify', section:'tools'},
    {id:'outreach',       icon:'✉', label:'Outreach', section:'tools'},
  ];
  const profile = currentProfile;
  return `<aside class="sidebar">
    <div class="sidebar-brand">
      <div class="logo">IT<span>Impact</span></div>
      <div class="sub">CRM & Projects</div>
    </div>
    <div style="padding:4px 16px 8px;display:flex;justify-content:flex-end;gap:6px;align-items:center">
      <button id="btn-theme-toggle" class="theme-toggle">${state.darkMode?'☀️ Light':'🌙 Dark'}</button>
      <button id="btn-notif-toggle" style="position:relative;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--text-2);font-size:14px;transition:all 0.15s">
        🔔${state.unreadCount > 0 ? `<span style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center">${state.unreadCount}</span>` : ''}
      </button>
    </div>
    <div style="padding:0 12px 6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;padding:8px 12px 4px">CRM</div></div>
    ${navItems.filter(n=>n.section==='crm').map(n=>`
      <div class="nav-item ${state.view===n.id?'active':''}" data-nav="${n.id}">
        <span class="nav-icon">${n.icon}</span>${n.label}
      </div>`).join('')}
    <div style="padding:0 12px 6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;padding:12px 12px 4px">Website Forms</div></div>
    ${navItems.filter(n=>n.section==='website').map(n=>`
      <div class="nav-item ${state.view===n.id?'active':''}" data-nav="${n.id}">
        <span class="nav-icon">${n.icon}</span>${n.label}
      </div>`).join('')}
    <div style="padding:0 12px 6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;padding:12px 12px 4px">Sales</div></div>
    ${navItems.filter(n=>n.section==='sales').map(n=>`
      <div class="nav-item ${state.view===n.id?'active':''}" data-nav="${n.id}">
        <span class="nav-icon">${n.icon}</span>${n.label}
      </div>`).join('')}
    <div style="padding:0 12px 6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;padding:12px 12px 4px">Tools</div></div>
    ${navItems.filter(n=>n.section==='tools').map(n=>`
      <div class="nav-item ${state.view===n.id?'active':''}" data-nav="${n.id}">
        <span class="nav-icon">${n.icon}</span>${n.label}
      </div>`).join('')}
    <div class="sidebar-footer">
      ${profile ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,var(--accent),#4f46e5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;font-family:Manrope,sans-serif">${(profile.full_name||profile.email||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:11px;color:var(--text);font-weight:500">${profile.full_name||profile.email}</div>
            <div style="font-size:9px;color:var(--text-3)">${profile.role}</div>
          </div>
        </div>
        <button class="logout-btn" id="btn-logout" style="font-family:'DM Mono',monospace;font-size:10px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;width:100%;transition:all 0.15s">Sign Out</button>
      ` : ''}
      ${state.dbStatus === 'connected'
        ? '<div style="margin-top:8px;color:#10b981;font-size:10px">● Database live</div>'
        : state.dbStatus === 'error'
        ? '<div style="margin-top:8px;color:#ef4444;font-size:10px">● DB error</div>'
        : state.dbStatus === 'not-configured'
        ? '<div style="margin-top:8px;color:#5a5a72;font-size:10px">● Local only</div>'
        : ''}
    </div>
  </aside>`;
}

// ── Pipeline View ─────────────────────────────────────────────────────
function renderPipeline() {
  const list = filteredSorted();
  const sectors = ['All', ...new Set(prospects.map(p=>p.sector))];
  const stageGroups = STAGES.map((s,i)=>({label:s,count:prospects.filter(p=>p.stage===i).length}));
  const notContacted = prospects.filter(p=>p.stage===0).length;
  const outreachActive = prospects.filter(p=>p.stage>=1&&p.stage<=2).length;
  const replied = prospects.filter(p=>p.stage===3).length;
  const spokenTo = prospects.filter(p=>p.spokenTo).length;
  const meetings = prospects.filter(p=>p.meetingBooked).length;
  const priorityCount = prospects.filter(p=>p.priority).length;
  const researchDone = prospects.filter(p=>p.researchDone).length;
  const outreachWritten = prospects.filter(p=>p.outreachWritten).length;
  const total = prospects.length || 1;

  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Pipeline</div>
      <div class="page-sub">${prospects.length} prospects · ${priorityCount} priority · ${spokenTo} spoken to · ${meetings} meetings</div>
    </div>
    <button class="find-leads-btn" id="btn-find-leads">⚡ Find More Leads</button>
  </div>

  <div class="metrics-row">
    <div class="metric-card"><div class="metric-label">Total Prospects</div><div class="metric-value">${prospects.length}</div><div class="metric-sub">${priorityCount} high priority</div></div>
    <div class="metric-card"><div class="metric-label">Not Contacted</div><div class="metric-value">${notContacted}</div><div class="metric-sub">${Math.round(notContacted/total*100)}% of pipeline</div></div>
    <div class="metric-card"><div class="metric-label">Outreach Active</div><div class="metric-value accent">${outreachActive}</div><div class="metric-sub">${researchDone} researched · ${outreachWritten} drafted</div></div>
    <div class="metric-card"><div class="metric-label">Replied / Spoken</div><div class="metric-value green">${replied + spokenTo}</div><div class="metric-sub">${meetings} meetings booked</div></div>
    <div class="metric-card"><div class="metric-label">Avg BANT</div><div class="metric-value accent">${avgBant()}</div><div class="metric-sub">out of 20</div></div>
  </div>

  <div class="funnel-row">
    ${stageGroups.map((g,i) => {
      const pct = Math.max(g.count / total * 100, 3);
      return `<div class="funnel-seg funnel-s${i}" style="flex:${pct}" data-stage="${i}" title="${g.label}: ${g.count}">
        ${g.count||''}
      </div>`;
    }).join('')}
  </div>

  <div class="search-bar">
    <input type="text" id="pipeline-search" placeholder="Search prospects by name, company, or sector..." value="${state.searchQuery||''}" />
  </div>

  <div class="stage-bar">
    <div class="stage-chip ${state.stageFilter===-1?'active':''}" data-stage="-1">All (${prospects.length})</div>
    ${stageGroups.map((g,i)=>`<div class="stage-chip ${state.stageFilter===i?'active':''}" data-stage="${i}">${g.label} (${g.count})</div>`).join('')}
  </div>

  <div class="filter-row">
    <span class="filter-label">Sector</span>
    ${sectors.map(s=>`<div class="sector-chip ${state.sectorFilter===s?'active':''}" data-sector="${s}">${s}</div>`).join('')}
    <select class="sort-select">
      <option value="priority" ${state.sort==='priority'?'selected':''}>Priority</option>
      <option value="bant" ${state.sort==='bant'?'selected':''}>BANT Score</option>
      <option value="name" ${state.sort==='name'?'selected':''}>Name A–Z</option>
      <option value="stage" ${state.sort==='stage'?'selected':''}>Stage</option>
    </select>
  </div>

  <table class="prospect-table">
    <thead><tr>
      <th>Prospect</th><th>Company</th><th>Sector</th><th>Stage</th>
      <th>BANT</th><th>Status</th><th>Actions</th><th></th>
    </tr></thead>
    <tbody id="prospect-tbody">
      ${list.map(p=>renderProspectRows(p)).join('')}
    </tbody>
  </table>`;
}

function renderProspectRows(p) {
  const isExpanded = state.expandedId === p.id;
  const expandedTr = isExpanded
    ? `<tr class="expanded-row"><td colspan="8">${renderExpandedContent(p)}</td></tr>` : '';

  return `
  <tr class="prospect-row ${p.priority?'priority-row':''}" data-id="${p.id}">
    <td>
      <div class="prospect-info">
        <div class="avatar">${p.initials}</div>
        <div>
          <div class="prospect-name">${p.name}${p.priority?' <span class="star">★</span>':''}</div>
          <div class="prospect-title">${p.title}</div>
        </div>
      </div>
    </td>
    <td><span class="company-name">${p.company}</span>${sourceBadge(p.source)}</td>
    <td><span class="sector-badge">${p.sector}</span></td>
    <td>${stagePillHTML(p.stage)}${p.spokenTo?'<span class="mini-badge spoken">📞 Spoken</span>':''}${p.meetingBooked?'<span class="mini-badge meeting">📅 Meeting</span>':''}</td>
    <td>${bantBarHTML(p.bant)}<span class="bant-score-num">${bantScore(p.bant)}</span></td>
    <td>
      <div class="status-dots">
        <div class="status-dot ${p.researchDone?'on':'off'}" title="Research done"></div>
        <div class="status-dot ${p.outreachWritten?'on':'off'}" title="Outreach written"></div>
      </div>
    </td>
    <td>
      <div class="row-actions">
        <button class="row-action-btn email-btn" data-email="${p.id}" title="Write Email">✉</button>
      </div>
    </td>
    <td><span class="chevron ${isExpanded?'open':''}">▾</span></td>
  </tr>
  ${expandedTr}`;
}

function renderExpandedContent(p) {
  const email = generateEmail(p);
  return `
  <div class="expanded-content">
    <div class="expanded-grid">
      <div>
        <div class="expanded-section-title">Buying Signal</div>
        <div class="signal-text">${p.signal}</div>
      </div>
      <div>
        <div class="expanded-section-title">BANT Breakdown</div>
        <div class="bant-detail">
          ${[['Budget','b','on-b'],['Authority','a','on-a'],['Need','n','on-n'],['Timeline','t','on-t']].map(([label,key,cls])=>`
            <div class="bant-row">
              <span class="bant-key">${label}</span>
              <div class="bant-pips">${Array.from({length:5},(_,i)=>`<div class="bant-pip ${i<p.bant[key]?cls:''}"></div>`).join('')}</div>
              <span class="bant-num">${p.bant[key]}/5</span>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div class="expanded-section-title">Contact Info</div>
        <div class="contact-info">
          <div class="contact-row"><span class="contact-row-label">Email</span><span class="contact-row-val">${p.email}</span></div>
          <div class="contact-row"><span class="contact-row-label">LinkedIn</span><span class="contact-row-val">${p.linkedin}</span></div>
          <div class="contact-row"><span class="contact-row-label">Location</span><span class="contact-row-val">${p.location}</span></div>
          ${p.lastContact?`<div class="contact-row"><span class="contact-row-label">Last Touch</span><span class="contact-row-val">${p.lastContact}</span></div>`:''}
        </div>
      </div>
    </div>

    <div class="expanded-section-title" style="margin-top:16px;margin-bottom:6px">Notes</div>
    <textarea class="notes-area" data-id="${p.id}" placeholder="Add notes…">${p.notes}</textarea>

    <div class="toggle-row">
      <button class="toggle-btn ${p.researchDone?'on':''}" data-toggle="research" data-id="${p.id}">
        ${p.researchDone?'✓':'○'} Research done
      </button>
      <button class="toggle-btn ${p.outreachWritten?'on':''}" data-toggle="outreach" data-id="${p.id}">
        ${p.outreachWritten?'✓':'○'} Outreach written
      </button>
      <button class="toggle-btn ${p.spokenTo?'on':''}" data-toggle="spoken" data-id="${p.id}">
        📞 ${p.spokenTo?'Spoken ✓':'Mark Spoken To'}
      </button>
      <button class="toggle-btn ${p.meetingBooked?'on meeting-on':''}" data-toggle="meeting" data-id="${p.id}">
        📅 ${p.meetingBooked?`Meeting: ${p.meetingDate||'booked'}`:'Book Meeting'}
      </button>
      <div class="stage-nav">
        <button class="stage-nav-btn" data-stage-move="-1" data-id="${p.id}" ${p.stage===0?'disabled':''}>← Back</button>
        <span class="current-stage-label">${STAGES[p.stage]}</span>
        <button class="stage-nav-btn" data-stage-move="1" data-id="${p.id}" ${p.stage===STAGES.length-1?'disabled':''}>Forward →</button>
      </div>
    </div>

    <div class="email-preview-row">
      <div class="email-preview-label">✉ Generated Email</div>
      <div class="email-subject-preview">${email.subject}</div>
      <div class="email-actions">
        <button class="copy-btn" data-copy="${escHtml(email.subject)}" data-label="Subject">Copy Subject</button>
        <button class="copy-btn" data-copy="${escHtml(email.body)}" data-label="Email">Copy Email</button>
        <button class="copy-btn" data-copy="${escHtml(email.linkedin)}" data-label="LinkedIn">Copy LinkedIn</button>
        <button class="expand-email-btn btn-accent" data-email="${p.id}">✉ Full Email →</button>
      </div>
    </div>
  </div>`;
}

// ── Find Leads Modal ──────────────────────────────────────────────────
function renderFindLeadsModal() {
  const bs = state.backendStatus;
  const apolloOk = bs && bs.apolloConfigured;
  const backendOk = bs && bs.status === 'ok';

  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box modal-wide">
      <div class="modal-header">
        <div class="modal-title">⚡ Find More Leads</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>

      ${!backendOk ? `
        <div class="setup-warning">
          <div class="setup-warning-title">⚠ API server not reachable</div>
          <div class="setup-warning-body">Start the backend server:<br><code>npm run dev:api</code><br>Or restart everything with <code>npm run dev</code></div>
        </div>` :
      !apolloOk ? `
        <div class="setup-warning">
          <div class="setup-warning-title">🔑 Apollo API key not configured</div>
          <div class="setup-warning-body">
            1. Go to <strong>app.apollo.io → Settings → Integrations → API Keys</strong><br>
            2. Copy your key<br>
            3. Open <code>sales-dashboard/.env</code> and set:<br>
            <code>APOLLO_API_KEY=your_key_here</code><br>
            4. Restart with <code>npm run dev</code>
          </div>
        </div>` : ''}

      <div class="find-leads-filters">
        <div class="filter-group">
          <label class="filter-group-label">Focus Sector</label>
          <div class="filter-chips" id="fl-sector-chips">
            ${['PE/VC','Healthcare','Dental'].map(s=>`
              <div class="sector-chip active" data-fl-sector="${s}">${s}</div>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-group-label">Locations</label>
          <div class="filter-chips" id="fl-loc-chips">
            ${['New York, NY','Chicago, IL','Boston, MA','Dallas, TX','Atlanta, GA'].map(l=>`
              <div class="sector-chip active" data-fl-loc="${l}">${l.split(',')[0]}</div>`).join('')}
          </div>
        </div>
      </div>

      <button class="find-leads-search-btn ${!backendOk||!apolloOk?'disabled':''}" id="fl-search-btn"
        ${!backendOk||!apolloOk?'disabled':''}>
        ${state.findLeadsLoading ? '<span class="spinner"></span> Searching Apollo…' : '🔍 Search Apollo Now'}
      </button>

      ${state.findLeadsError ? `<div class="find-leads-error">⚠ ${state.findLeadsError}</div>` : ''}

      ${state.findLeadsResults.length ? `
        <div class="find-leads-results">
          <div class="find-leads-results-header">${state.findLeadsResults.length} results — click Add to include in pipeline</div>
          ${state.findLeadsResults.map(p => {
            const alreadyAdded = prospects.some(x => x.id === p.id || (x.name===p.name && x.company===p.company));
            return `
            <div class="fl-result-card ${alreadyAdded?'already-added':''}">
              <div class="fl-result-avatar">${p.initials}</div>
              <div class="fl-result-info">
                <div class="fl-result-name">${p.name}</div>
                <div class="fl-result-sub">${p.title} · ${p.company}</div>
                <div class="fl-result-sig">${p.signal}</div>
              </div>
              <div class="fl-result-bant">BANT ${bantScore(p.bant)}</div>
              ${alreadyAdded
                ? `<div class="fl-result-added-label">✓ In pipeline</div>`
                : `<button class="fl-add-btn" data-fl-add-idx="${state.findLeadsResults.indexOf(p)}">+ Add</button>`}
            </div>`;
          }).join('')}
        </div>` : ''}
    </div>
  </div>`;
}

// ── Email Modal ───────────────────────────────────────────────────────
function renderEmailModal(p) {
  const email = generateEmail(p);
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box modal-email">
      <div class="modal-header">
        <div>
          <div class="modal-title">✉ Outreach for ${p.name}</div>
          <div class="modal-sub">${p.title} · ${p.company}</div>
        </div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>

      <div class="email-modal-sections">
        <div class="email-modal-section">
          <div class="email-modal-section-label">
            Subject Line
            <button class="copy-btn" data-copy="${escHtml(email.subject)}" data-label="Subject">Copy</button>
          </div>
          <div class="email-subject-box">${email.subject}</div>
        </div>

        <div class="email-modal-section">
          <div class="email-modal-section-label">
            Cold Email — Touch 1
            <button class="copy-btn" data-copy="${escHtml(email.body)}" data-label="Email">Copy</button>
          </div>
          <div class="email-body-box">${email.body}</div>
        </div>

        <div class="email-modal-section">
          <div class="email-modal-section-label">
            Follow-Up — Touch 2
            <button class="copy-btn" data-copy="${escHtml(email.followUp)}" data-label="Follow-up">Copy</button>
          </div>
          <div class="email-body-box">${email.followUp}</div>
        </div>

        <div class="email-modal-section">
          <div class="email-modal-section-label">
            LinkedIn Connection Request
            <button class="copy-btn" data-copy="${escHtml(email.linkedin)}" data-label="LinkedIn">Copy</button>
          </div>
          <div class="email-body-box">${email.linkedin}</div>
        </div>
      </div>

      <div class="email-modal-footer">
        <button class="toggle-btn ${p.outreachWritten?'on':''}" data-toggle="outreach" data-id="${p.id}" id="modal-outreach-toggle">
          ${p.outreachWritten?'✓ Outreach marked written':'○ Mark outreach written'}
        </button>
      </div>
    </div>
  </div>`;
}

// ── Social Media View ─────────────────────────────────────────────────
function renderSocial() {
  const platforms = [{id:'linkedin',label:'LinkedIn',icon:'in'}];
  const postTypes = [
    {id:'casestudy',label:'Case Study'},
    {id:'insight',label:'Insight'},
    {id:'hottake',label:'Hot Take'},
    {id:'question',label:'Question'},
  ];
  const angles = {
    casestudy: [{id:'sound',label:'Sound Physicians'},{id:'oshi',label:'Oshi Health'},{id:'clove',label:'Clove Dental'}],
    insight:   [{id:'pe',label:'PE IT Due Diligence'},{id:'ai',label:'AI in Healthcare'}],
    hottake:   [{id:'cio',label:'Full-Time CIO Myth'}],
    question:  [{id:'dso',label:'DSO IT Question'}],
  };
  const currentAngles = angles[state.socialPostType] || [];
  const post = getPostContent();

  return `
  <div class="page-header">
    <div class="page-title">Social Media</div>
    <div class="page-sub">LinkedIn content engine · case studies · thought leadership</div>
  </div>

  <div class="social-layout">
    <div class="social-controls">
      <div class="social-section-title">Platform</div>
      <div class="social-platform-tabs">
        ${platforms.map(pl=>`
          <button class="social-tab ${state.socialPlatform===pl.id?'active':''}" data-platform="${pl.id}">
            <span class="social-tab-icon">${pl.icon}</span>${pl.label}
          </button>`).join('')}
      </div>

      <div class="social-section-title" style="margin-top:20px">Post Type</div>
      <div class="social-type-list">
        ${postTypes.map(t=>`
          <button class="social-type-btn ${state.socialPostType===t.id?'active':''}" data-posttype="${t.id}">
            ${t.label}
          </button>`).join('')}
      </div>

      <div class="social-section-title" style="margin-top:20px">Angle / Reference</div>
      <div class="social-type-list">
        ${currentAngles.map(a=>`
          <button class="social-type-btn ${state.socialAngle===a.id?'active':''}" data-angle="${a.id}">
            ${a.label}
          </button>`).join('')}
      </div>
    </div>

    <div class="social-preview">
      ${post ? `
        <div class="social-post-header">
          <div class="social-post-platform">LinkedIn · ${post.title}</div>
          <button class="copy-btn" data-copy="${escHtml(post.post)}" data-label="Post" style="margin-left:auto">Copy Post</button>
        </div>
        <div class="social-post-preview">
          <div class="social-post-author">
            <div class="social-author-avatar">A</div>
            <div>
              <div class="social-author-name">Amish · IT Impact Consulting</div>
              <div class="social-author-sub">Fractional CIO · PE-backed healthcare & dental</div>
            </div>
          </div>
          <div class="social-post-body">${post.post.replace(/\n/g,'<br>')}</div>
          <div class="social-post-actions">
            <span class="social-reaction">👍 Like</span>
            <span class="social-reaction">💬 Comment</span>
            <span class="social-reaction">🔁 Repost</span>
          </div>
        </div>` :
        `<div class="social-empty">Select a post type and angle to generate content</div>`}

      <div class="social-content-ideas">
        <div class="social-section-title" style="margin-top:28px;margin-bottom:14px">Content Ideas This Week</div>
        ${[
          {day:'Mon',type:'Case Study',hook:'Sound Physicians AI infrastructure — what we built in 90 days'},
          {day:'Wed',type:'Insight',hook:'Why PE firms skip IT due diligence (and what it costs them at exit)'},
          {day:'Fri',type:'Hot Take',hook:'Hiring a full-time CIO before you have a roadmap is backwards'},
        ].map(i=>`
          <div class="content-idea-card">
            <div class="content-idea-day">${i.day}</div>
            <div class="content-idea-type">${i.type}</div>
            <div class="content-idea-hook">${i.hook}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── ICP View ──────────────────────────────────────────────────────────
function renderICP() {
  return `
  <div class="page-header">
    <div class="page-title">ICP & Triggers</div>
    <div class="page-sub">Ideal customer profile · buying signals · reference clients</div>
  </div>
  <div class="icp-grid">
    <div class="icp-card"><div class="icp-card-title">Target Titles</div><div class="tag-list">${icpProfile.titles.map(t=>`<span class="tag accent">${t}</span>`).join('')}</div></div>
    <div class="icp-card"><div class="icp-card-title">Target Sectors</div><div class="tag-list">${icpProfile.sectors.map(s=>`<span class="tag">${s}</span>`).join('')}</div></div>
    <div class="icp-card"><div class="icp-card-title">Geography</div><div class="tag-list">${icpProfile.geography.map(g=>`<span class="tag">${g}</span>`).join('')}</div></div>
    <div class="icp-card"><div class="icp-card-title">Company Size</div><div class="size-text">${icpProfile.companySize}</div><div style="margin-top:12px"><div class="icp-card-title">Seniority</div><div class="tag-list">${icpProfile.seniority.map(s=>`<span class="tag">${s}</span>`).join('')}</div></div></div>
  </div>
  <div class="section-heading">Buying Triggers</div>
  <div class="triggers-grid">
    ${buyingTriggers.map(t=>`<div class="trigger-card"><div class="trigger-num">${t.num}</div><div><div class="trigger-title">${t.title}</div><div class="trigger-desc">${t.desc}</div></div></div>`).join('')}
  </div>
  <div class="section-heading">Best Reference Clients</div>
  <div class="clients-grid">
    ${bestClients.map(c=>`<div class="client-card"><div class="client-name">${c.name}</div><div class="client-desc">${c.desc}</div><div class="client-work">${c.work}</div><div class="client-sector">${c.sector}</div></div>`).join('')}
  </div>`;
}

// ── Disqualify View ───────────────────────────────────────────────────
function renderDisqualify() {
  return `
  <div class="page-header">
    <div class="page-title">Disqualify</div>
    <div class="page-sub">Hard stops and caution flags · Apollo search filters</div>
  </div>
  <div class="section-heading" style="margin-top:0">Disqualification Rules</div>
  <div class="disq-grid">
    ${disqualifiers.map(d=>`<div class="disq-card"><div class="disq-badge ${d.type}">${d.type==='hard'?'HARD STOP':'CAUTION'}</div><div><div class="disq-title">${d.title}</div><div class="disq-desc">${d.desc}</div></div></div>`).join('')}
  </div>
  <div class="section-heading">Apollo Search Filters</div>
  <div class="apollo-grid">
    ${Object.entries(apolloFilters).map(([key,vals])=>`<div class="apollo-card"><div class="apollo-card-title">${key.replace(/([A-Z])/g,' $1').trim()}</div><div class="tag-list">${vals.map(v=>`<span class="tag">${v}</span>`).join('')}</div></div>`).join('')}
  </div>`;
}

// ── Outreach View ─────────────────────────────────────────────────────
function renderOutreach() {
  const seqs = [outreachSequences.neilBansal, outreachSequences.jamesDale];
  return `
  <div class="page-header">
    <div class="page-title">Outreach</div>
    <div class="page-sub">Written sequences · copy-ready email and LinkedIn</div>
  </div>
  ${seqs.map(seq=>`
    <div class="outreach-prospect-block">
      <div class="outreach-prospect-header">
        <div>
          <div class="outreach-prospect-name">${seq.prospect.split('—')[0].trim()}</div>
          <div class="outreach-prospect-role">${seq.prospect.split('—')[1]?.trim()||''}</div>
        </div>
        <span class="outreach-subject-badge">${seq.subjectLine}</span>
      </div>
      <div class="outreach-section">
        <div class="outreach-section-label"><span>${seq.touch1.type} · Subject</span><button class="copy-btn" data-copy="${escHtml(seq.touch1.subject)}" data-label="Subject">Copy</button></div>
        <div class="outreach-subject">${seq.touch1.subject}</div>
      </div>
      <div class="outreach-section">
        <div class="outreach-section-label"><span>Email Body</span><button class="copy-btn" data-copy="${escHtml(seq.touch1.body)}" data-label="Email">Copy</button></div>
        <div class="outreach-body">${seq.touch1.body}</div>
      </div>
      ${seq.linkedinRequest?`<div class="outreach-section"><div class="outreach-section-label"><span>LinkedIn</span><button class="copy-btn" data-copy="${escHtml(seq.linkedinRequest)}" data-label="LinkedIn">Copy</button></div><div class="outreach-body">${seq.linkedinRequest}</div></div>`:''}
    </div>`).join('')}`;
}

// ── Escape HTML ───────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Render Modal ──────────────────────────────────────────────────────
function renderModal() {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();
  if (!state.modal) return;

  let html = '';
  if (state.modal === 'findLeads') html = renderFindLeadsModal();
  else if (state.modal === 'email') {
    const p = prospects.find(x=>x.id===state.modalData);
    if (p) html = renderEmailModal(p);
  }
  if (!html) return;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  attachModalEvents();
}

// ── Render ────────────────────────────────────────────────────────────
function renderView() {
  if (state.view==='leads')           return renderLeads();
  if (state.view==='projects')        return renderProjects();
  if (state.view==='team')            return renderTeam();
  if (state.view==='articles')        return renderArticlesView();
  if (state.view==='social-planner')  return renderSocialPlanner();
  if (state.view==='analytics')       return renderAnalyticsView();
  if (state.view==='agents')          return renderAgentsView();
  if (state.view==='map')             return renderMapView();
  if (state.view==='contact-subs')    return renderContactSubmissions();
  if (state.view==='general-cvs')     return renderGeneralCVs();
  if (state.view==='job-apps')        return renderJobApplications();
  if (state.view==='ai-assessments')  return renderAIAssessments();
  if (state.view==='pipeline')   return renderPipeline();
  if (state.view==='recruiting') return renderRecruiting();
  if (state.view==='social')     return renderSocial();
  if (state.view==='icp')        return renderICP();
  if (state.view==='disqualify') return renderDisqualify();
  if (state.view==='outreach')   return renderOutreach();
  return '';
}

// ── Recruiting View ───────────────────────────────────────────────────
function statusCfg(id) { return CANDIDATE_STATUSES.find(s=>s.id===id) || CANDIDATE_STATUSES[0]; }

function renderRecruiting() {
  const tabs = [
    {id:'positions', label:'Positions', count: positions.length},
    {id:'candidates', label:'All Candidates', count: candidates.length},
    {id:'pool', label:'Talent Pool', count: candidates.length},
  ];
  const activePos = state.recPosition || positions[0].id;

  return `
  <div class="page-header" style="margin-bottom:0">
    <div>
      <div class="page-title">Recruiting</div>
      <div class="page-sub">${positions.filter(p=>p.status==='Active').length} active positions · ${candidates.length} candidates tracked</div>
    </div>
  </div>

  <div class="rec-tabs">
    ${tabs.map(t=>`<button class="rec-tab ${state.recTab===t.id?'active':''}" data-rectab="${t.id}">${t.label} <span class="rec-tab-count">${t.count}</span></button>`).join('')}
  </div>

  ${state.recTab==='positions' ? renderPositionsTab() : ''}
  ${state.recTab==='candidates' ? renderCandidatesTab(activePos) : ''}
  ${state.recTab==='pool' ? renderTalentPoolTab() : ''}`;
}

function renderPositionsTab() {
  return `
  <div class="rec-positions-grid">
    ${positions.map(pos => {
      const posCands = candidates.filter(c=>c.positionId===pos.id);
      const shortlisted = posCands.filter(c=>c.status==='shortlisted').length;
      const emailSent = posCands.filter(c=>c.emailSent).length;
      const isExpanded = state.recExpandedCandidate === pos.id;
      return `
      <div class="rec-pos-card ${pos.priority?'priority-pos':''}">
        <div class="rec-pos-header" data-expand-pos="${pos.id}">
          <div class="rec-pos-left">
            <div class="rec-pos-title">${pos.title}</div>
            <div class="rec-pos-meta">${pos.location} · ${pos.comp}</div>
          </div>
          <div class="rec-pos-badges">
            <span class="rec-pos-badge active">● Active</span>
            <span class="rec-pos-stat">${posCands.length} CVs</span>
            <span class="rec-pos-stat green">${shortlisted} shortlisted</span>
            <span class="rec-pos-stat indigo">${emailSent} emailed</span>
            <span class="rec-chevron ${isExpanded?'open':''}">▾</span>
          </div>
        </div>
        ${isExpanded ? `
        <div class="rec-pos-body">
          <div class="rec-pos-section-title">About</div>
          <div class="rec-pos-text">${pos.about}</div>
          <div class="rec-two-col" style="margin-top:14px">
            <div>
              <div class="rec-pos-section-title">Key Responsibilities</div>
              <ul class="rec-list">${pos.responsibilities.map(r=>`<li>${r}</li>`).join('')}</ul>
            </div>
            <div>
              <div class="rec-pos-section-title">Requirements</div>
              <ul class="rec-list">${pos.requirements.map(r=>`<li>${r}</li>`).join('')}</ul>
            </div>
          </div>
          <div class="rec-pos-footer">
            <a href="${pos.driveUrl}" target="_blank" class="rec-drive-link">📁 Open in Google Drive →</a>
            <button class="rec-view-cands-btn" data-viewcands="${pos.id}">View ${posCands.length} Candidates →</button>
          </div>
          <div class="rec-pos-section-title" style="margin-top:18px">Candidates for this role</div>
          <div class="rec-mini-cand-list">
            ${candidates.filter(c=>c.positionId===pos.id).map(c => {
              const st = statusCfg(c.status);
              return `<div class="rec-mini-cand">
                <div class="rec-mini-avatar">${c.initials}</div>
                <div class="rec-mini-info">
                  <div class="rec-mini-name">${c.name}</div>
                  <div class="rec-mini-role">${c.currentRole} · ${c.currentCompany}</div>
                </div>
                <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
                ${c.emailSent?'<span class="email-sent-badge">✉ Sent</span>':'<span class="email-not-sent-badge">✉ Not sent</span>'}
                <a href="${c.driveUrl}" target="_blank" class="rec-cv-link">CV →</a>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderCandidatesTab(activePos) {
  const posFilter = state.recPosition;
  let list = posFilter ? candidates.filter(c=>c.positionId===posFilter) : candidates;

  return `
  <div class="rec-cands-layout">
    <div class="rec-pos-sidebar">
      <div class="rec-pos-sidebar-label">Filter by Position</div>
      <button class="rec-pos-filter-btn ${!posFilter?'active':''}" data-posfilter="">All (${candidates.length})</button>
      ${positions.map(p=>`
        <button class="rec-pos-filter-btn ${posFilter===p.id?'active':''}" data-posfilter="${p.id}">
          ${p.title} <span style="color:var(--text-3)">(${candidates.filter(c=>c.positionId===p.id).length})</span>
        </button>`).join('')}
    </div>
    <div class="rec-cands-list">
      ${list.map(c => {
        const st = statusCfg(c.status);
        const pos = positions.find(p=>p.id===c.positionId);
        return `
        <div class="rec-cand-card">
          <div class="rec-cand-avatar">${c.initials}</div>
          <div class="rec-cand-body">
            <div class="rec-cand-top">
              <div>
                <div class="rec-cand-name">${c.name}</div>
                <div class="rec-cand-role">${c.currentRole} · ${c.currentCompany}</div>
                <div class="rec-cand-loc">📍 ${c.location} ${pos?`· <span class="rec-pos-tag">${pos.title}</span>`:''}
                </div>
              </div>
              <div class="rec-cand-actions">
                <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
                <select class="cand-status-select" data-cand-status="${c.id}">
                  ${CANDIDATE_STATUSES.map(s=>`<option value="${s.id}" ${c.status===s.id?'selected':''}>${s.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="rec-cand-summary">${c.summary}</div>
            ${c.tags.length?`<div class="rec-cand-tags">${c.tags.map(t=>`<span class="rec-tag">${t}</span>`).join('')}</div>`:''}
            <div class="rec-cand-footer">
              <label class="email-toggle">
                <input type="checkbox" data-email-toggle="${c.id}" ${c.emailSent?'checked':''}>
                <span>Email sent to candidate</span>
              </label>
              ${c.email?`<span class="rec-email">${c.email}</span>`:''}
              <a href="${c.driveUrl}" target="_blank" class="rec-cv-link">📄 View CV →</a>
            </div>
            ${c.notes?`<div class="rec-cand-notes-display">${c.notes}</div>`:''}
            <textarea class="rec-notes-area" data-rec-notes="${c.id}" placeholder="Add notes about this candidate…">${c.notes||''}</textarea>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderTalentPoolTab() {
  const byPos = {};
  positions.forEach(p => { byPos[p.id] = candidates.filter(c=>c.positionId===p.id); });

  return `
  <div class="talent-pool">
    <div class="talent-pool-header">
      <div class="talent-pool-stats">
        <div class="metric-card" style="display:inline-flex;flex-direction:column;margin-right:10px">
          <div class="metric-label">Total CVs</div>
          <div class="metric-value">${candidates.length}</div>
        </div>
        <div class="metric-card" style="display:inline-flex;flex-direction:column;margin-right:10px">
          <div class="metric-label">Shortlisted</div>
          <div class="metric-value green">${candidates.filter(c=>c.status==='shortlisted').length}</div>
        </div>
        <div class="metric-card" style="display:inline-flex;flex-direction:column">
          <div class="metric-label">Emails Sent</div>
          <div class="metric-value accent">${candidates.filter(c=>c.emailSent).length}</div>
        </div>
      </div>
    </div>

    ${positions.map(pos => {
      const posCands = byPos[pos.id] || [];
      if (!posCands.length) return '';
      return `
      <div class="talent-pool-section">
        <div class="talent-pool-pos-header">
          <span class="talent-pool-pos-title">${pos.title}</span>
          <span class="talent-pool-pos-count">${posCands.length} candidates</span>
          <span class="talent-pool-pos-short">${posCands.filter(c=>c.status==='shortlisted').length} shortlisted</span>
        </div>
        <table class="talent-pool-table">
          <thead><tr>
            <th>Name</th><th>Current Role</th><th>Location</th><th>Status</th><th>Email</th><th>CV</th>
          </tr></thead>
          <tbody>
            ${posCands.map(c => {
              const st = statusCfg(c.status);
              return `<tr>
                <td><div style="display:flex;align-items:center;gap:8px">
                  <div class="rec-mini-avatar" style="width:28px;height:28px;font-size:9px">${c.initials}</div>
                  <span style="font-weight:500;font-size:12px">${c.name}</span>
                </div></td>
                <td style="font-size:11px;color:var(--text-2)">${c.currentRole}</td>
                <td style="font-size:11px;color:var(--text-3)">${c.location}</td>
                <td><span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span></td>
                <td>
                  ${c.emailSent
                    ? '<span style="font-size:10px;color:var(--green);font-family:DM Mono,monospace">✉ Sent</span>'
                    : '<span style="font-size:10px;color:var(--text-3);font-family:DM Mono,monospace">Not sent</span>'}
                </td>
                <td><a href="${c.driveUrl}" target="_blank" class="rec-cv-link">View →</a></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('')}
  </div>`
}

function render() {
  if (!state.authenticated) {
    document.getElementById('app').innerHTML = renderAuthScreen();
    attachAuthEvents();
    return;
  }
  document.getElementById('app').innerHTML = `
    ${renderSidebar()}
    <main class="main" id="main-content">${renderView()}</main>
    <div class="toast-container" id="toast-container"></div>`;
  attachEvents();
  if (state.modal) renderModal();
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
  if (state.showApiKeyModal) {
    const el = document.createElement('div');
    el.innerHTML = renderApiKeyModal();
    document.body.appendChild(el.firstElementChild);
    attachApiKeyModalEvents();
  }
  // Notification panel
  const existingNotif = document.getElementById('notif-panel');
  if (existingNotif) existingNotif.remove();
  if (state.showNotifPanel) {
    const el = document.createElement('div');
    el.innerHTML = renderNotifPanel();
    document.body.appendChild(el.firstElementChild);
    if (el.querySelector('style')) document.body.appendChild(el.querySelector('style'));
    attachNotifEvents();
  }
}

// ── Attach Events ─────────────────────────────────────────────────────
function attachEvents() {
  // Sign out
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut();
    state.authenticated = false;
    render();
  });
  // Nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', async () => {
      if (state.chatUnsub) { state.chatUnsub(); state.chatUnsub = null; }
      state.activeProject = null;
      state.view=el.dataset.nav; state.expandedId=null; state.modal=null;
      if (el.dataset.nav === 'leads' && state.leads.length === 0) {
        state.leadsLoading = true; render();
        state.leads = await fetchLeads();
        state.leadsLoading = false;
      }
      if (el.dataset.nav === 'projects' && state.projects.length === 0) {
        state.projectsLoading = true; render();
        state.projects = await fetchProjects();
        state.projectsLoading = false;
      }
      if (el.dataset.nav === 'team') { state.team = await fetchTeam(); }
      if (el.dataset.nav === 'articles' && state.articles.length === 0) { state.articles = await fetchArticles(); }
      if (el.dataset.nav === 'social-planner' && state.socialPosts.length === 0) {
        if (state.team.length === 0) state.team = await fetchTeam();
        state.socialPosts = await fetchSocialPosts();
      }
      if (el.dataset.nav === 'analytics') {
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
      if (el.dataset.nav === 'agents') {
        state.activeAgent = null; state.agentOutput = ''; state.agentError = null;
      }
      if (el.dataset.nav === 'map') {
        if (state.team.length === 0) state.team = await fetchTeam();
        if (state.leads.length === 0) state.leads = await fetchLeads();
        if (state.projects.length === 0) state.projects = await fetchProjects();
        const g = buildGraph({ leads: state.leads, projects: state.projects, team: state.team, positions, candidates });
        state.mapNodes = g.nodes; state.mapEdges = g.edges;
      }
      if (el.dataset.nav === 'contact-subs') state.contactSubmissions = await fetchContactSubmissions();
      if (el.dataset.nav === 'general-cvs') state.generalCVs = await fetchGeneralCVs();
      if (el.dataset.nav === 'job-apps') state.jobApplications = await fetchJobApplications();
      if (el.dataset.nav === 'ai-assessments') state.aiAssessments = await fetchAIAssessments();
      render();
    });
  });
  // Stage filter
  document.querySelectorAll('[data-stage]').forEach(el => {
    el.addEventListener('click', () => { state.stageFilter=parseInt(el.dataset.stage); state.expandedId=null; render(); });
  });
  // Sector filter
  document.querySelectorAll('[data-sector]').forEach(el => {
    el.addEventListener('click', () => { state.sectorFilter=el.dataset.sector; state.expandedId=null; render(); });
  });
  // Sort
  const ss = document.querySelector('.sort-select');
  if (ss) ss.addEventListener('change', e => { state.sort=e.target.value; render(); });

  // Search bar
  const searchInput = document.getElementById('pipeline-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      state.expandedId = null;
      refreshTbody();
    });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  // Funnel segment clicks
  document.querySelectorAll('.funnel-seg').forEach(el => {
    el.addEventListener('click', () => {
      const s = parseInt(el.dataset.stage);
      state.stageFilter = state.stageFilter === s ? -1 : s;
      state.expandedId = null;
      render();
    });
  });

  // Find Leads button
  const flBtn = document.getElementById('btn-find-leads');
  if (flBtn) flBtn.addEventListener('click', async () => {
    state.modal='findLeads';
    state.findLeadsResults=[];
    state.findLeadsError=null;
    const bs = await checkBackend();
    state.backendStatus = bs;
    render();
  });

  // Row expand — delegate on tbody
  const tbody = document.getElementById('prospect-tbody');
  if (tbody) tbody.addEventListener('click', e => {
    const emailBtn = e.target.closest('[data-email]');
    if (emailBtn) {
      const id = emailBtn.dataset.email;
      const pid = isNaN(id) ? id : parseInt(id);
      state.modal = 'email';
      state.modalData = pid;
      renderModal();
      return;
    }
    const expandEmailBtn = e.target.closest('.expand-email-btn');
    if (expandEmailBtn) {
      const pid = expandEmailBtn.dataset.email;
      const id = isNaN(pid) ? pid : parseInt(pid);
      state.modal = 'email';
      state.modalData = id;
      renderModal();
      return;
    }
    if (e.target.closest('button,textarea,select,a')) return;
    const row = e.target.closest('.prospect-row');
    if (!row) return;
    const rawId = row.dataset.id;
    const id = isNaN(rawId) ? rawId : parseInt(rawId);
    state.expandedId = state.expandedId===id ? null : id;
    refreshTbody();
  });

  attachExpandedEvents();

  // Recruiting tabs
  document.querySelectorAll('[data-rectab]').forEach(el => {
    el.addEventListener('click', () => { state.recTab=el.dataset.rectab; render(); });
  });
  // Position expand
  document.querySelectorAll('[data-expand-pos]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.expandPos;
      state.recExpandedCandidate = state.recExpandedCandidate===id ? null : id;
      render();
    });
  });
  // View candidates button
  document.querySelectorAll('[data-viewcands]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); state.recTab='candidates'; state.recPosition=el.dataset.viewcands; render(); });
  });
  // Position filter in candidates tab
  document.querySelectorAll('[data-posfilter]').forEach(el => {
    el.addEventListener('click', () => { state.recPosition=el.dataset.posfilter||null; render(); });
  });
  // Candidate status select
  document.querySelectorAll('[data-cand-status]').forEach(sel => {
    sel.addEventListener('change', e => {
      const c = candidates.find(x=>x.id===sel.dataset.candStatus);
      if (c) { c.status=e.target.value; persistCandidate(c); showToast(`${c.name} → ${e.target.value}`); render(); }
    });
  });
  // Email sent toggle
  document.querySelectorAll('[data-email-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const c = candidates.find(x=>x.id===cb.dataset.emailToggle);
      if (c) { c.emailSent=cb.checked; persistCandidate(c); showToast(cb.checked?`✉ Email marked sent — ${c.name}`:`Email unmarked — ${c.name}`); }
    });
  });
  // Candidate notes
  document.querySelectorAll('[data-rec-notes]').forEach(ta => {
    ta.addEventListener('input', () => {
      const c = candidates.find(x=>x.id===ta.dataset.recNotes);
      if (c) { c.notes=ta.value; persistCandidate(c); }
    });
  });

  // Social Media controls
  document.querySelectorAll('[data-platform]').forEach(el => {
    el.addEventListener('click', () => { state.socialPlatform=el.dataset.platform; render(); });
  });
  document.querySelectorAll('[data-posttype]').forEach(el => {
    el.addEventListener('click', () => {
      state.socialPostType=el.dataset.posttype;
      const defaultAngles = {casestudy:'sound',insight:'pe',hottake:'cio',question:'dso'};
      state.socialAngle = defaultAngles[state.socialPostType]||'sound';
      render();
    });
  });
  document.querySelectorAll('[data-angle]').forEach(el => {
    el.addEventListener('click', () => { state.socialAngle=el.dataset.angle; render(); });
  });

  attachExpandedEvents();
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

function attachExpandedEvents() {
  // Notes
  document.querySelectorAll('.notes-area').forEach(ta => {
    ta.addEventListener('input', () => {
      const rawId = ta.dataset.id;
      const id = isNaN(rawId) ? rawId : parseInt(rawId);
      const p = prospects.find(x=>x.id===id);
      if (p) { p.notes=ta.value; persistProspect(p); }
    });
  });
  // Toggles
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => handleToggle(btn));
  });
  // Stage nav
  document.querySelectorAll('[data-stage-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rawId = btn.dataset.id;
      const id = isNaN(rawId) ? rawId : parseInt(rawId);
      const p = prospects.find(x=>x.id===id);
      if (!p) return;
      const newStage = Math.max(0, Math.min(STAGES.length-1, p.stage + parseInt(btn.dataset.stageMove)));
      if (newStage!==p.stage) { p.stage=newStage; persistProspect(p); showToast(`${p.name} → ${STAGES[newStage]}`); refreshTbody(); }
    });
  });
  attachCopyButtons();
}

function handleToggle(btn) {
  const rawId = btn.dataset.id;
  const id = isNaN(rawId) ? rawId : parseInt(rawId);
  const p = prospects.find(x=>x.id===id);
  if (!p) return;
  const type = btn.dataset.toggle;
  if (type==='research') { p.researchDone=!p.researchDone; showToast(p.researchDone?`Research done ✓ — ${p.name}`:`Research unmarked — ${p.name}`); }
  else if (type==='outreach') { p.outreachWritten=!p.outreachWritten; showToast(p.outreachWritten?`Outreach written ✓ — ${p.name}`:`Outreach unmarked — ${p.name}`); }
  else if (type==='spoken') {
    p.spokenTo=!p.spokenTo;
    if (p.spokenTo) {
      const ts = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      p.notes = (p.notes?p.notes+'\n':'') + `📞 Spoken to on ${ts}`;
      if (p.stage < 3) { p.stage=3; showToast(`${p.name} → Replied + Spoken To ✓`); }
      else showToast(`📞 Marked spoken to — ${p.name}`);
    } else showToast(`Spoken to removed — ${p.name}`);
  }
  else if (type==='meeting') {
    if (!p.meetingBooked) {
      const date = prompt('Meeting date (e.g. Jun 5, 2026):', new Date(Date.now()+7*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
      if (date===null) return;
      p.meetingBooked=true; p.meetingDate=date;
      const ts = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      p.notes = (p.notes?p.notes+'\n':'') + `📅 Meeting booked for ${date} (logged ${ts})`;
      if (p.stage < 4) p.stage=4;
      showToast(`📅 Meeting booked for ${date} — ${p.name}`);
    } else {
      p.meetingBooked=false; p.meetingDate=null;
      showToast(`Meeting removed — ${p.name}`);
    }
  }
  persistProspect(p);
  refreshTbody();
  // Update modal toggle if open
  const modalToggle = document.getElementById('modal-outreach-toggle');
  if (modalToggle && type==='outreach') {
    modalToggle.className = `toggle-btn ${p.outreachWritten?'on':''}`;
    modalToggle.textContent = p.outreachWritten ? '✓ Outreach marked written' : '○ Mark outreach written';
  }
}

function attachCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.onclick = () => {
      const text = (btn.dataset.copy||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      const label = btn.dataset.label || 'Text';
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = `✓ Copied!`;
        btn.classList.add('copied');
        setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); },2000);
        showToast(`${label} copied to clipboard`, 'success');
      }).catch(()=>{ showToast('Copy failed — try manually selecting text','error'); });
    };
  });
}

function attachModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  // Close button
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  // Click outside
  overlay.addEventListener('click', e => { if (e.target===overlay) closeModal(); });
  // Escape key
  document.addEventListener('keydown', function esc(e) {
    if (e.key==='Escape') { closeModal(); document.removeEventListener('keydown',esc); }
  });

  // Find Leads: sector/location filter chips
  document.querySelectorAll('[data-fl-sector]').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('active'));
  });
  document.querySelectorAll('[data-fl-loc]').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('active'));
  });

  // Search button
  document.getElementById('fl-search-btn')?.addEventListener('click', async () => {
    const activeSectors = [...document.querySelectorAll('[data-fl-sector].active')].map(el=>el.dataset.flSector);
    const activeLocs = [...document.querySelectorAll('[data-fl-loc].active')].map(el=>el.dataset.flLoc);
    const sectorKeywords = activeSectors.flatMap(s => ({
      'PE/VC':['private equity','venture capital','growth equity'],
      'Healthcare':['healthcare','hospital','health system','medical'],
      'Dental':['dental','dentistry','oral health','DSO'],
    }[s]||[]));
    await searchApolloLeads({ sectors: sectorKeywords.length?sectorKeywords:undefined, locations:activeLocs.length?activeLocs:undefined });
  });

  // Add lead buttons
  document.querySelectorAll('[data-fl-add-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.flAddIdx);
      const p = state.findLeadsResults[idx];
      if (!p) return;
      const alreadyIn = prospects.some(x=>x.id===p.id||(x.name===p.name&&x.company===p.company));
      if (alreadyIn) { showToast('Already in pipeline'); return; }
      prospects.push(p);
      addedFromSearch.push(p);
      persistAdded(p);
      showToast(`${p.name} added to pipeline ✓`, 'success');
      renderModal(); // refresh modal to show "In pipeline"
      // Also refresh main table if visible
      const tbody = document.getElementById('prospect-tbody');
      if (tbody) { tbody.innerHTML = filteredSorted().map(x=>renderProspectRows(x)).join(''); attachExpandedEvents(); }
    });
  });

  attachCopyButtons();

  // Toggle in email modal
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => handleToggle(btn));
  });
}

function closeModal() {
  state.modal = null;
  state.modalData = null;
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

function refreshTbody() {
  const tbody = document.getElementById('prospect-tbody');
  if (tbody) {
    tbody.innerHTML = filteredSorted().map(p=>renderProspectRows(p)).join('');
    attachExpandedEvents();
  }
}

// ── Auth Events ──────────────────────────────────────────────────────
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

// ── Lead Events ──────────────────────────────────────────────────────
function attachLeadEvents() {
  document.getElementById('btn-new-lead')?.addEventListener('click', () => {
    state.leadModal = true;
    state.leadEditData = {};
    render();
  });
  document.querySelectorAll('[data-lead-filter]').forEach(el => {
    el.addEventListener('click', () => { state.leadFilter = el.dataset.leadFilter; render(); });
  });
  document.querySelectorAll('[data-lead-status]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = sel.dataset.leadStatus;
      await updateLead(id, { status: e.target.value });
      state.leads = await fetchLeads();
      showToast('Lead status updated', 'success');
      render();
    });
  });
  document.querySelectorAll('[data-edit-lead]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('select')) return;
      const lead = state.leads.find(l => l.id === el.dataset.editLead);
      if (lead) { state.leadModal = true; state.leadEditData = { ...lead }; render(); }
    });
  });
}

function attachLeadModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  document.getElementById('modal-close')?.addEventListener('click', closeLeadModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeLeadModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeLeadModal(); });
  document.getElementById('btn-delete-lead')?.addEventListener('click', async () => {
    if (!confirm('Delete this lead?')) return;
    await deleteLead(state.leadEditData.id);
    state.leads = await fetchLeads();
    showToast('Lead deleted', 'success');
    closeLeadModal();
  });
  document.getElementById('lead-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), value: parseFloat(fd.get('value'))||0, source: fd.get('source'), notes: fd.get('notes') };
    if (state.leadEditData?.id) {
      await updateLead(state.leadEditData.id, data);
      showToast('Lead updated', 'success');
    } else {
      await createLead(data);
      showToast('Lead added!', 'success');
    }
    state.leads = await fetchLeads();
    closeLeadModal();
  });
}

function closeLeadModal() {
  state.leadModal = null;
  state.leadEditData = null;
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
  render();
}

// ── Project Events ───────────────────────────────────────────────────
function attachProjectEvents() {
  document.getElementById('btn-new-project')?.addEventListener('click', async () => {
    const name = prompt('Project name:');
    if (!name) return;
    const desc = prompt('Description (optional):') || '';
    await createProject(name, desc);
    state.projects = await fetchProjects();
    showToast('Project created!', 'success');
    render();
  });
  document.querySelectorAll('[data-open-project]').forEach(el => {
    el.addEventListener('click', async () => {
      const p = state.projects.find(x => x.id === el.dataset.openProject);
      if (p) await openProject(p);
    });
  });
  document.getElementById('btn-back-projects')?.addEventListener('click', () => {
    if (state.chatUnsub) { state.chatUnsub(); state.chatUnsub = null; }
    state.activeProject = null;
    render();
  });
  document.querySelectorAll('[data-ptab]').forEach(el => {
    el.addEventListener('click', async () => {
      state.projectTab = el.dataset.ptab;
      await loadProjectTabData();
      render();
    });
  });
  // Message board
  document.getElementById('new-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createMessage(state.activeProject.id, fd.get('title'), fd.get('body'));
    state.projectMessages = await fetchMessages(state.activeProject.id);
    showToast('Message posted', 'success');
    render();
  });
  // Todo lists
  document.getElementById('new-todolist-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createTodoList(state.activeProject.id, fd.get('listName'));
    state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
    showToast('To-do list created', 'success');
    render();
  });
  document.querySelectorAll('.add-todo-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await createTodo(form.dataset.listId, fd.get('title'));
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      render();
    });
  });
  document.querySelectorAll('[data-toggle-todo]').forEach(cb => {
    cb.addEventListener('change', async () => {
      await toggleTodo(cb.dataset.toggleTodo, cb.checked);
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      render();
    });
  });
  document.querySelectorAll('[data-delete-todo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteTodo(btn.dataset.deleteTodo);
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      render();
    });
  });
  // Schedule
  document.getElementById('new-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createEvent(state.activeProject.id, fd.get('title'), '', fd.get('date'));
    state.projectEvents = await fetchEvents(state.activeProject.id);
    showToast('Event added', 'success');
    render();
  });
  // Chat
  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = fd.get('message').trim();
    if (!msg) return;
    await sendChatMessage(state.activeProject.id, msg);
    e.target.reset();
    // Message will appear via realtime subscription
    state.projectChat = await fetchChatMessages(state.activeProject.id);
    render();
    scrollChatToBottom();
  });
  // Check-ins
  document.getElementById('new-checkin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createCheckin(state.activeProject.id, fd.get('question'), fd.get('frequency'));
    state.projectCheckins = await fetchCheckins(state.activeProject.id);
    showToast('Check-in created', 'success');
    render();
  });
  document.querySelectorAll('.checkin-respond-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await respondToCheckin(form.dataset.checkinId, fd.get('response'));
      state.projectCheckins = await fetchCheckins(state.activeProject.id);
      render();
    });
  });
  scrollChatToBottom();
}

async function openProject(p) {
  state.activeProject = p;
  state.projectTab = 'board';
  await loadProjectTabData();
  render();
}

async function loadProjectTabData() {
  const pid = state.activeProject?.id;
  if (!pid) return;
  if (state.projectTab === 'board') state.projectMessages = await fetchMessages(pid);
  if (state.projectTab === 'todos') state.projectTodoLists = await fetchTodoLists(pid);
  if (state.projectTab === 'schedule') state.projectEvents = await fetchEvents(pid);
  if (state.projectTab === 'chat') {
    state.projectChat = await fetchChatMessages(pid);
    if (state.chatUnsub) state.chatUnsub();
    state.chatUnsub = subscribeToChatMessages(pid, (msg) => {
      if (!state.projectChat.find(m => m.id === msg.id)) {
        state.projectChat.push(msg);
        render();
        scrollChatToBottom();
      }
    });
  }
  if (state.projectTab === 'checkins') state.projectCheckins = await fetchCheckins(pid);
}

// ── Team Events ─────────────────────────────────────────────────────
function attachTeamEvents() {
  document.getElementById('btn-unlock-team')?.addEventListener('click', () => {
    const code = prompt('🔒 Enter CEO code to unlock team management:');
    if (code === CEO_CODE) {
      ceoUnlocked = true;
      showToast('🔓 Team management unlocked', 'success');
      render();
    } else if (code !== null) {
      showToast('❌ Incorrect code', 'error');
    }
  });
  document.getElementById('btn-lock-team')?.addEventListener('click', () => {
    ceoUnlocked = false;
    showToast('🔒 Team management locked', 'info');
    render();
  });
  document.getElementById('btn-add-member')?.addEventListener('click', () => {
    state.editMemberData = {};
    renderTeamModal();
  });
  document.querySelectorAll('[data-edit-member]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = state.team.find(x => x.id === btn.dataset.editMember);
      if (m) { state.editMemberData = { ...m }; renderTeamModal(); }
    });
  });
  document.querySelectorAll('[data-delete-member]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.memberName;
      if (!confirm(`Remove ${name} from the team?\n\nThis will delete their profile. They will need to sign up again.`)) return;
      try {
        await supabase.from('profiles').delete().eq('id', btn.dataset.deleteMember);
        state.team = await fetchTeam();
        showToast(`${name} removed from team`, 'success');
        render();
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      }
    });
  });
}

function renderTeamModal() {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.innerHTML = renderAddMemberModal();
  document.body.appendChild(el.firstElementChild);
  attachTeamModalEvents();
}

function attachTeamModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.editMemberData = null; overlay.remove(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const skillsRaw = fd.get('skills') || '';
    const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const desigRole = fd.get('designation_role') || '';
    const updates = {
      full_name: fd.get('full_name'),
      designation: desigRole || fd.get('designation') || '',
      department: fd.get('department'),
      phone: fd.get('phone'),
      role: desigRole.toLowerCase().includes('ceo') || desigRole.toLowerCase().includes('admin') ? 'admin' : 'member',
      status: fd.get('status'),
      bio: fd.get('bio'),
      skills,
    };
    try {
      if (state.editMemberData?.id) {
        await updateProfile(state.editMemberData.id, updates);
        showToast('Member updated ✓', 'success');
      } else {
        showToast('Tell the new member to sign up first, then edit their profile here', 'info');
      }
      state.team = await fetchTeam();
      closeModal();
      render();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

// ── Article Events ───────────────────────────────────────────────────
function attachArticleEvents() {
  document.getElementById('btn-new-article')?.addEventListener('click', () => {
    state.articleModal = true; state.articleEditData = {}; render();
  });
  document.querySelectorAll('[data-article-filter]').forEach(el => {
    el.addEventListener('click', () => { state.articleFilter = el.dataset.articleFilter; render(); });
  });
  document.querySelectorAll('[data-edit-article]').forEach(el => {
    el.addEventListener('click', () => {
      const a = state.articles.find(x => x.id === el.dataset.editArticle);
      if (a) { state.articleModal = true; state.articleEditData = { ...a }; render(); }
    });
  });
}

function attachArticleModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.articleModal = null; state.articleEditData = null; overlay.remove(); render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-delete-article')?.addEventListener('click', async () => {
    if (!confirm('Delete this article?')) return;
    await deleteArticle(state.articleEditData.id);
    state.articles = await fetchArticles();
    showToast('Article deleted', 'success');
    closeModal();
  });
  document.getElementById('article-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { title: fd.get('title'), body: fd.get('body'), category: fd.get('category'), cover_image: fd.get('cover_image'), status: fd.get('status') };
    if (state.articleEditData?.id) {
      await updateArticle(state.articleEditData.id, data);
      showToast('Article updated', 'success');
    } else {
      await createArticle(data);
      showToast('Article created!', 'success');
    }
    state.articles = await fetchArticles();
    closeModal();
  });
}

// ── Social Planner Events ────────────────────────────────────────────
function attachSocialPlannerEvents() {
  document.getElementById('btn-new-social-post')?.addEventListener('click', async () => {
    if (state.team.length === 0) state.team = await fetchTeam();
    state.socialPostModal = true; render();
  });
  document.querySelectorAll('[data-sp-filter]').forEach(el => {
    el.addEventListener('click', () => { state.socialPostFilter = el.dataset.spFilter; render(); });
  });
  document.querySelectorAll('[data-approve-post]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await approvePost(btn.dataset.approvePost, btn.dataset.postId, true);
      state.socialPosts = await fetchSocialPosts();
      showToast('Post approved ✓', 'success');
      render();
    });
  });
  document.querySelectorAll('[data-reject-post]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const comment = prompt('Reason for rejection (optional):') || '';
      await approvePost(btn.dataset.rejectPost, btn.dataset.postId, false, comment);
      state.socialPosts = await fetchSocialPosts();
      showToast('Post rejected', 'info');
      render();
    });
  });
}

function attachSocialPostModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.socialPostModal = null; overlay.remove(); render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('social-post-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const platforms = fd.getAll('platforms');
    const approverIds = fd.getAll('approvers');
    await createSocialPost({
      content: fd.get('content'),
      platforms,
      scheduled_date: fd.get('scheduled_date') || null,
    }, approverIds);
    state.socialPosts = await fetchSocialPosts();
    showToast(approverIds.length ? 'Post submitted for approval' : 'Post created!', 'success');
    closeModal();
  });
}

// ── Analytics Events ─────────────────────────────────────────────────
function attachAnalyticsEvents() {
  document.querySelectorAll('[data-analytics-days]').forEach(el => {
    el.addEventListener('click', async () => {
      state.analyticsDays = parseInt(el.dataset.analyticsDays);
      state.analyticsData = await fetchAnalyticsOverview(state.analyticsDays);
      if (state.googleConnected) await fetchGAData();
      render();
    });
  });
  document.getElementById('btn-connect-google')?.addEventListener('click', () => {
    const clientId = '557532595072-k4218aj9elu93lmoehoao1qv2shvrq9q.apps.googleusercontent.com';
    const redirectUri = `${location.origin}/.netlify/functions/google-oauth-callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    location.href = authUrl;
  });
  document.getElementById('btn-refresh-ga')?.addEventListener('click', async () => {
    await fetchGAData();
    render();
  });
  document.getElementById('btn-analytics-custom')?.addEventListener('click', async () => {
    const from = document.getElementById('analytics-from')?.value;
    const to = document.getElementById('analytics-to')?.value;
    if (!from || !to) { showToast('Select both dates', 'error'); return; }
    const days = Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1;
    if (days < 1) { showToast('Invalid date range', 'error'); return; }
    state.analyticsDays = days;
    state.analyticsData = await fetchAnalyticsOverview(days);
    if (state.googleConnected) await fetchGAData(from, to);
    showToast(`Showing ${days} days of data`, 'success');
    render();
  });
}

// ── Website Submissions Events ──────────────────────────────────────
function attachSubmissionEvents() {
  document.querySelectorAll('[data-toggle-submission]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggleSubmission;
      state.expandedSubmission = state.expandedSubmission === id ? null : id;
      render();
    });
  });
  document.querySelectorAll('[data-jobapp-filter]').forEach(el => {
    el.addEventListener('click', () => { state.jobAppFilter = el.dataset.jobappFilter; render(); });
  });
  document.querySelectorAll('[data-submission-status]').forEach(el => {
    el.addEventListener('change', async (e) => {
      e.stopPropagation();
      const table = el.dataset.submissionTable;
      const id = el.dataset.submissionStatus.split('-').slice(1).join('-');
      const newStatus = el.value;
      if (table === 'contact_submissions') { await updateContactStatus(id, newStatus); state.contactSubmissions = await fetchContactSubmissions(); }
      if (table === 'general_cv_submissions') { await updateGeneralCVStatus(id, newStatus); state.generalCVs = await fetchGeneralCVs(); }
      if (table === 'job_applications') { await updateJobApplicationStatus(id, newStatus); state.jobApplications = await fetchJobApplications(); }
      if (table === 'ai_assessments') { await updateAIAssessmentStatus(id, newStatus); state.aiAssessments = await fetchAIAssessments(); }
      showToast('Status updated', 'success');
      render();
    });
  });
}

// ── Agent Events ─────────────────────────────────────────────────────
function attachAgentEvents() {
  document.getElementById('btn-agent-settings')?.addEventListener('click', () => { state.showApiKeyModal = true; render(); });
  document.getElementById('btn-agent-settings-2')?.addEventListener('click', () => { state.showApiKeyModal = true; render(); });
  document.querySelectorAll('[data-open-agent]').forEach(el => {
    el.addEventListener('click', () => {
      state.activeAgent = el.dataset.openAgent;
      state.agentOutput = ''; state.agentError = null; state.agentInput = '';
      render();
    });
  });
  document.getElementById('btn-back-agents')?.addEventListener('click', () => {
    state.activeAgent = null; render();
  });
  document.getElementById('btn-run-agent')?.addEventListener('click', async () => {
    const input = document.getElementById('agent-input')?.value || '';
    state.agentInput = input;
    state.agentLoading = true; state.agentError = null; state.agentOutput = '';
    render();
    try {
      let output;
      if (state.activeAgent === 'marketing') output = await runMarketingPlannerAgent(input);
      else if (state.activeAgent === 'leadfinder') {
        const sectorCounts = {};
        prospects.forEach(p => { sectorCounts[p.sector] = (sectorCounts[p.sector]||0)+1; });
        const existingSummary = `Sales pipeline (${prospects.length} prospects): ${Object.entries(sectorCounts).map(([s,c])=>`${s} (${c})`).join(', ')}. Sample companies: ${prospects.slice(0,10).map(p=>p.company).join(', ')}. CRM leads (${state.leads.length}): ${state.leads.map(l=>l.company).filter(Boolean).join(', ')}. ICP: ${JSON.stringify(icpProfile).substring(0,500)}`;
        output = await runLeadFinderAgent(input, existingSummary);
      }
      else if (state.activeAgent === 'headhunter') output = await runHRHeadhunterAgent(input);
      state.agentOutput = output;
    } catch (err) {
      state.agentError = err.message;
    }
    state.agentLoading = false;
    render();
  });
  document.getElementById('btn-copy-agent-output')?.addEventListener('click', () => {
    navigator.clipboard.writeText(state.agentOutput);
    showToast('Copied to clipboard', 'success');
  });
  document.getElementById('chat-agent-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const q = fd.get('question')?.trim();
    if (!q) return;
    state.chatHistory.push({ role: 'user', content: q });
    state.agentLoading = true;
    e.target.reset();
    render();
    if (state.leads.length === 0) state.leads = await fetchLeads();
    if (state.projects.length === 0) state.projects = await fetchProjects();
    const ctx = `Leads (${state.leads.length}): ${state.leads.slice(0,8).map(l=>l.name+' @ '+(l.company||'?')+' ['+l.status+']').join('; ')}. Projects (${state.projects.length}): ${state.projects.map(p=>p.name).join(', ')}. Sales prospects: ${prospects.length}.`;
    try {
      const history = state.chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const result = await runJarvis(q, ctx, history);
      if (result.type === 'tool_calls') {
        const summaries = [];
        for (const call of result.calls) {
          summaries.push(await executeJarvisAction(call));
        }
        state.chatHistory.push({ role: 'assistant', content: summaries.join('\n') });
        state.leads = await fetchLeads();
        state.projects = await fetchProjects();
      } else {
        state.chatHistory.push({ role: 'assistant', content: result.content });
      }
    } catch (err) {
      state.chatHistory.push({ role: 'assistant', content: 'Error: ' + err.message });
    }
    state.agentLoading = false;
    render();
    setTimeout(() => { const el = document.getElementById('chat-agent-messages'); if (el) el.scrollTop = el.scrollHeight; }, 50);
  });
}

async function fetchGAData(customFrom, customTo) {
  try {
    let start = `${state.analyticsDays}daysAgo`, end = 'today';
    if (customFrom && customTo) { start = customFrom; end = customTo; }
    const res = await fetch(`/.netlify/functions/ga-data?start=${start}&end=${end}`);
    const data = await res.json();
    state.gaData = data;
  } catch (err) {
    state.gaData = { error: err.message };
  }
}

async function executeJarvisAction(call) {
  try {
    if (call.name === 'create_lead') {
      await createLead({ name: call.args.name, company: call.args.company||'', email: call.args.email||'', value: call.args.value||0, notes: call.args.notes||'' });
      return `✅ Created lead "${call.args.name}"${call.args.company ? ' at '+call.args.company : ''}`;
    }
    if (call.name === 'update_lead_status') {
      const lead = state.leads.find(l => l.name.toLowerCase().includes(call.args.lead_name.toLowerCase()));
      if (!lead) return `⚠ Couldn't find a lead matching "${call.args.lead_name}"`;
      await updateLead(lead.id, { status: call.args.status });
      return `✅ Updated "${lead.name}" to status: ${call.args.status}`;
    }
    if (call.name === 'create_project') {
      await createProject(call.args.name, call.args.description || '');
      return `✅ Created project "${call.args.name}"`;
    }
    return `Did nothing (${call.name})`;
  } catch (err) {
    return `❌ Action failed: ${err.message}`;
  }
}

function attachApiKeyModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.showApiKeyModal = false; overlay.remove(); render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-clear-key')?.addEventListener('click', () => {
    clearApiKey();
    showToast('API key removed', 'success');
    closeModal();
  });
  document.getElementById('api-key-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setApiKey(fd.get('apiKey'), fd.get('provider'));
    showToast('API key saved ✓', 'success');
    closeModal();
  });
}

// ── Map Events ───────────────────────────────────────────────────────
function attachMapEvents() {
  document.getElementById('btn-close-node-panel')?.addEventListener('click', () => {
    state.mapSelectedNode = null; render();
  });
  document.querySelectorAll('.map-node').forEach(el => {
    let dragging = false, startX, startY, origX, origY;
    el.addEventListener('mousedown', (e) => {
      dragging = true;
      const id = el.dataset.nodeId;
      const p = state.mapPositions[id];
      startX = e.clientX; startY = e.clientY; origX = p.x; origY = p.y;
      e.preventDefault();
    });
    el.addEventListener('click', (e) => {
      if (Math.abs(e.clientX - startX) < 3 && Math.abs(e.clientY - startY) < 3) {
        state.mapSelectedNode = el.dataset.nodeId;
        render();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const svg = document.getElementById('map-svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = 1100 / rect.width;
      const id = el.dataset.nodeId;
      state.mapPositions[id] = {
        x: origX + (e.clientX - startX) * scale,
        y: origY + (e.clientY - startY) * scale,
      };
      const g = document.querySelector(`g[data-node-id="${id}"]`);
      if (g) g.setAttribute('transform', `translate(${state.mapPositions[id].x},${state.mapPositions[id].y})`);
      updateMapEdges();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  });
}

function updateMapEdges() {
  const edgesG = document.getElementById('map-edges');
  if (!edgesG) return;
  const lines = edgesG.querySelectorAll('line');
  state.mapEdges.forEach((e, i) => {
    const f = state.mapPositions[e.from], t = state.mapPositions[e.to];
    const line = lines[i];
    if (line && f && t) {
      line.setAttribute('x1', f.x); line.setAttribute('y1', f.y);
      line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
    }
  });
}

// ── Notification Events ──────────────────────────────────────────────
function attachNotifEvents() {
  document.getElementById('btn-close-notif')?.addEventListener('click', () => { state.showNotifPanel = false; render(); });
  document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
    await markAllRead();
    state.notifications = await fetchNotifications();
    state.unreadCount = 0;
    render();
  });
  document.querySelectorAll('[data-notif-id]').forEach(el => {
    el.addEventListener('click', async () => {
      await markAsRead(el.dataset.notifId);
      state.notifications = await fetchNotifications();
      state.unreadCount = await getUnreadCount();
      const link = el.dataset.notifLink;
      if (link) { state.view = link; state.showNotifPanel = false; }
      render();
    });
  });
}

function scrollChatToBottom() {
  setTimeout(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  // Handle Google OAuth redirect
  const params = new URLSearchParams(location.search);
  if (params.get('google_connected') === '1') {
    localStorage.setItem('google_connected', '1');
    window.history.replaceState({}, '', location.pathname);
  }

  // Apply saved theme
  if (state.darkMode) document.documentElement.setAttribute('data-theme', 'dark');

  // Show loading state
  document.getElementById('app').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#08080d;color:#9494b0;font-family:'DM Mono',monospace;font-size:12px;flex-direction:column;gap:12px">
      <div style="width:24px;height:24px;border:2px solid rgba(99,102,241,0.3);border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite"></div>
      ${DB_ENABLED ? 'Connecting...' : 'Loading…'}
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

  // Initialize auth
  if (DB_ENABLED) {
    const user = await initAuth();
    state.authenticated = !!user;
    // Listen for auth changes
    window.addEventListener('auth-change', () => {
      const wasAuth = state.authenticated;
      state.authenticated = !!currentUser;
      if (state.authenticated && !wasAuth) {
        state.view = 'leads';
      }
      if (wasAuth !== state.authenticated) render();
    });
  } else {
    state.authenticated = true; // skip auth if no DB
  }

  if (DB_ENABLED) {
    try {
      const dbState = await loadDbState();

      // Merge Supabase prospect state
      Object.entries(dbState.prospects).forEach(([id, row]) => {
        const p = prospects.find(x => String(x.id) === id);
        if (p) {
          p.stage           = row.stage           ?? p.stage;
          p.notes           = row.notes           ?? p.notes;
          p.researchDone    = row.research_done    ?? p.researchDone;
          p.outreachWritten = row.outreach_written ?? p.outreachWritten;
          p.spokenTo        = row.spoken_to        ?? p.spokenTo;
          p.meetingBooked   = row.meeting_booked   ?? p.meetingBooked;
          p.meetingDate     = row.meeting_date     ?? p.meetingDate;
        }
      });

      // Merge Supabase candidate state
      Object.entries(dbState.candidates).forEach(([id, row]) => {
        const c = candidates.find(x => String(x.id) === id);
        if (c) {
          c.status    = row.status     ?? c.status;
          c.emailSent = row.email_sent ?? c.emailSent;
          c.notes     = row.notes      ?? c.notes;
        }
      });

      // Load added prospects from Supabase
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
    state.view = 'leads';
    state.leadsLoading = true;
    render();
    state.leads = await fetchLeads();
    state.leadsLoading = false;
    state.unreadCount = await getUnreadCount();
    state.notifUnsub = subscribeToNotifications((notif) => {
      state.unreadCount++;
      showToast(notif.title, 'info');
      render();
    });
  }
  render();
  checkBackend().then(bs => { state.backendStatus = bs; });
}

boot();
