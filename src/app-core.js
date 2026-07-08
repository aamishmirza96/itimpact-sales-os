// Shared application core: state, seed-data wiring, persistence and cross-page
// helpers. Extracted verbatim from main.js during the HubSpot-style restructure.
import { STAGES, prospects as rawProspects } from './data.js';
import { candidates as rawCandidates } from './recruiting.js';
import { syncProspect, syncCandidate, syncAddedProspect } from './supabase.js';

// Late-bound shell hooks: pages call app.render() / app.renderModal() so they
// don't need a circular import of the shell (main.js assigns these at boot).
export const app = {
  render: () => {},
  renderModal: () => {},
};

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
      stageChangedAt: s.stageChangedAt || null, // set on stage moves (kanban/stage nav) for days-in-stage
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
  sortDir: 'asc',
  pipelineView: 'board', // 'board' (kanban) | 'table'
  leadPanel: null,       // lead id shown in the right slide-over
  candidatePanel: null,  // candidate id shown in the right slide-over
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
  accessMemberData: null, // member whose role/permissions are being edited
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
  linkedinConnected: localStorage.getItem('linkedin_connected') === '1',
  liveVisitors: [],
  liveVisitorsInterval: null,
  // Website Submissions
  contactSubmissions: [],
  generalCVs: [],
  jobApplications: [],
  aiAssessments: [],
  jobAppFilter: 'all',
  showAddCVModal: false,
  expandedSubmission: null,
  // Tasks
  tasks: [],
  taskModal: null,   // 'new' | 'edit'
  taskEditData: null,
  taskFilter: 'all', // 'all' | 'todo' | 'in_progress' | 'completed'
  taskEntityContext: null, // { entity_type, entity_id, entity_label } when opening from a card
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
  dbPositions: [],
  dbCandidates: [],
  recruitingDbReady: false,
  positionModal: null,   // 'new' | 'edit'
  positionEditData: null,
  candidateModal: null,  // 'new' | 'edit'
  candidateEditData: null,
  driveImportModal: null, // { positionId } or null
  dbStatus: null,
  jobBoardSelected: null,
  persisted: loadSaved(),
};

// Dev-only hook so tests can inspect/seed state from the console
if (import.meta.env.DEV) window.__salesOsState = state;

function persistProspect(p) {
  state.persisted[p.id] = {
    stage: p.stage, notes: p.notes,
    researchDone: p.researchDone, outreachWritten: p.outreachWritten,
    spokenTo: p.spokenTo, meetingBooked: p.meetingBooked, meetingDate: p.meetingDate,
    stageChangedAt: p.stageChangedAt || null,
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
  else if (state.sort === 'company') list.sort((a,b) => a.company.localeCompare(b.company));
  else if (state.sort === 'sector') list.sort((a,b) => a.sector.localeCompare(b.sector));
  if (state.sortDir === 'desc') list.reverse();
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
  app.renderModal();
  try {
    const r = await fetch('/api/leads/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });
    const d = await r.json();
    if (!r.ok) { state.findLeadsError = d.error || 'Search failed'; state.findLeadsLoading = false; app.renderModal(); return; }
    state.findLeadsResults = (d.people || []).map(mapApolloPersonToProspect);
    state.findLeadsLoading = false;
    app.renderModal();
  } catch (e) {
    state.findLeadsError = e.message;
    state.findLeadsLoading = false;
    app.renderModal();
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

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
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

function fmt$(n) { if (!n) return '—'; return n >= 1000000 ? '$'+(n/1000000).toFixed(1)+'M' : n >= 1000 ? '$'+(n/1000).toFixed(0)+'k' : '$'+n; }

// ── Escape HTML ───────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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


export {
  prospects, candidates, addedFromSearch, state,
  persistProspect, persistAdded, persistCandidate,
  bantScore, avgBant, filteredSorted, showToast,
  checkBackend, searchApolloLeads, mapApolloPersonToProspect,
  generateEmail, timeAgo, bantBarHTML, stagePillHTML, sourceBadge,
  fmt$, escHtml, attachCopyButtons,
};
