// Reports page: website analytics, AI agents (incl. Jarvis) and the
// relationship map.
import { state, prospects, escHtml, showToast, app } from '../app-core.js';
import { icpProfile } from '../data.js';
import { fetchAnalyticsOverview, fetchLiveVisitors, flagFor } from '../analytics.js';
import {
  getApiKey, getProvider, setApiKey, clearApiKey, hasApiKey,
  runMarketingPlannerAgent, runLeadFinderAgent, runHRHeadhunterAgent, runJarvis,
} from '../ai-agents.js';
import { NODE_TYPE_LABELS } from '../relationship-map.js';
import { fetchLeads, createLead, updateLead } from '../leads.js';
import { fetchProjects, createProject } from '../projects.js';

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
        <input type="date" id="analytics-from" style="padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;font-family:Arial,sans-serif;outline:none" />
        <span style="color:var(--text-3);font-size:11px">to</span>
        <input type="date" id="analytics-to" style="padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;font-family:Arial,sans-serif;outline:none" />
        <button id="btn-analytics-custom" style="padding:6px 12px;border-radius:6px;border:none;background:var(--gradient-accent);color:#fff;cursor:pointer;font-family:Arial,sans-serif;font-size:10px">Go</button>
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
    ${!googleConnected ? `<button class="find-leads-btn" id="btn-connect-google">Connect Google</button>` : `<button id="btn-refresh-ga" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg-1);color:var(--text-2);cursor:pointer;font-family:Arial,sans-serif;font-size:11px">Refresh GA Data</button>`}
  </div>

  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);${state.liveVisitors.length?'animation:livePulse 1.5s infinite':''}"></span>
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text)">Live Now — ${state.liveVisitors.length} visitor${state.liveVisitors.length===1?'':'s'}</div>
    </div>
    ${state.liveVisitors.length === 0 ? `<div style="font-size:12px;color:var(--text-3);padding:8px 0">No one online right now. Visitors appear here within 90 seconds of activity.</div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      ${state.liveVisitors.map(v => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-2);border-radius:10px;border:1px solid var(--border)">
          <span style="font-size:22px">${flagFor(v.country)}</span>
          <div style="min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${v.country || 'Unknown location'}</div>
            <div style="font-size:10px;color:var(--text-3);font-family:Arial,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.device==='mobile'?'📱':'💻'} ${(v.last_page||'').replace(/^https?:\/\/[^/]+/,'')||'/'}</div>
          </div>
        </div>`).join('')}
    </div>`}
  </div>
  <style>@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>

  ${state.gaData ? `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px;margin-bottom:20px">
    <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">📊 Google Analytics — Top Pages (Last 7 Days)</div>
    ${state.gaData.error ? `<div style="color:var(--red);font-size:12px">${state.gaData.error}</div>` : `
    <table style="width:100%;font-size:12px">
      <thead><tr style="color:var(--text-3);font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase"><th style="text-align:left;padding:6px 0">Page</th><th style="text-align:right">Views</th><th style="text-align:right">Users</th><th style="text-align:right">Avg Duration</th></tr></thead>
      <tbody>
        ${(state.gaData.rows||[]).slice(0,12).map(r => `
          <tr style="border-top:1px solid var(--border-subtle)">
            <td style="padding:8px 0;color:var(--text-2)">${r.dimensionValues[0]?.value || '/'}</td>
            <td style="text-align:right;color:var(--accent);font-weight:600">${r.metricValues[0]?.value || 0}</td>
            <td style="text-align:right;color:var(--text-2)">${r.metricValues[1]?.value || 0}</td>
            <td style="text-align:right;color:var(--text-3);font-family:Arial,sans-serif">${Math.round(r.metricValues[2]?.value || 0)}s</td>
          </tr>`).join('')}
      </tbody>
    </table>`}
  </div>` : ''}

  <div class="metrics-row" style="grid-template-columns:repeat(5,1fr)">
    <div class="metric-card"><div class="metric-label">Sessions</div><div class="metric-value">${d.sessions}</div><div class="metric-sub">unique visitors</div></div>
    <div class="metric-card"><div class="metric-label">Page Views</div><div class="metric-value accent">${d.pageViews}</div><div class="metric-sub">${avgPages} pages/session</div></div>
    <div class="metric-card"><div class="metric-label">Clicks</div><div class="metric-value green">${d.clicks ?? 0}</div><div class="metric-sub">tracked interactions</div></div>
    <div class="metric-card"><div class="metric-label">Avg Time</div><div class="metric-value">${d.avgTime >= 60 ? Math.floor(d.avgTime/60)+'m '+d.avgTime%60+'s' : d.avgTime+'s'}</div><div class="metric-sub">per session</div></div>
    <div class="metric-card"><div class="metric-label">Devices</div><div class="metric-value">${devices.desktop||0}<span style="font-size:14px;color:var(--text-3)"> / </span>${devices.mobile||0}</div><div class="metric-sub">desktop / mobile</div></div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px">
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:18px">📈 Daily Page Views</div>
      ${d.dailyData?.length ? `
      <div style="display:flex;align-items:flex-end;gap:4px;height:140px">
        ${d.dailyData.map(([day, count]) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-family:Arial,sans-serif;font-size:9px;color:var(--accent-2);font-weight:600">${count}</div>
            <div style="width:100%;background:var(--gradient-accent);border-radius:6px 6px 0 0;height:${Math.max(count/maxDaily*100,6)}px;transition:height 0.5s;box-shadow:0 0 8px rgba(139,92,246,0.2)"></div>
            <div style="font-family:Arial,sans-serif;font-size:8px;color:var(--text-3);white-space:nowrap">${day}</div>
          </div>`).join('')}
      </div>` : '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No page view data yet</div>'}
    </div>
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:18px">🏆 Top Pages</div>
      ${d.topPages.length ? d.topPages.map((p,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-family:Arial,sans-serif;font-size:10px;color:${i===0?'var(--amber)':i===1?'var(--text-2)':'var(--text-3)'};width:20px;font-weight:${i<3?'700':'400'}">${i+1}.</span>
          <span style="flex:1;font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.url}</span>
          <span style="font-family:Arial,sans-serif;font-size:11px;color:var(--accent-2);font-weight:600">${p.count}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px">No page data yet</div>'}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">🖱️ Recent Clicks</div>
      ${(d.events||[]).filter(e=>e.event_type==='click').slice(0,8).map(e => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-family:Arial,sans-serif;font-size:10px;background:var(--accent-glow);color:var(--accent-2);padding:2px 6px;border-radius:4px">${e.element_tag||'?'}</span>
          <span style="flex:1;font-size:11px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.element_text||'(no text)'}</span>
          <span style="font-family:Arial,sans-serif;font-size:9px;color:var(--text-3)">${e.page_url||'/'}</span>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px">No clicks recorded yet</div>'}
    </div>
    <div style="background:var(--bg-card-flat);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:14px">🕐 Recent Sessions</div>
      ${(d.totalSessions||[]).slice(0,8).map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-subtle)">
          <span style="font-size:12px">${s.device==='mobile'?'📱':'💻'}</span>
          <span style="flex:1;font-size:11px;color:var(--text-2)">${s.pages_viewed||1} pages · ${s.total_time||0}s</span>
          <span style="font-family:Arial,sans-serif;font-size:9px;color:var(--text-3)">${new Date(s.started_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
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
        <div style="font-family:Arial,sans-serif;font-weight:700;font-size:17px;color:var(--text);margin-bottom:6px">${a.name}</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.6">${a.desc}</div>
        <div style="margin-top:14px;font-family:Arial,sans-serif;font-size:11px;color:${a.color};font-weight:600">Open Agent →</div>
      </div>`).join('')}
  </div>`;
}

function renderAgentDetail() {
  const a = AGENTS.find(x => x.id === state.activeAgent);
  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <button id="btn-back-agents" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text-3);cursor:pointer;font-family:Arial,sans-serif;font-size:11px">← Back</button>
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
    <label style="font-family:Arial,sans-serif;font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:10px">
      ${a.id==='marketing' ? 'Context (audience, focus, recent wins, etc.)' : a.id==='leadfinder' ? 'Target context (industry, ICP details)' : 'Position details (title, requirements, seniority)'}
    </label>
    <textarea id="agent-input" rows="4" placeholder="${a.id==='marketing' ? 'e.g. Focus on our new AI engineering recruiting service, target healthcare and PE clients' : a.id==='leadfinder' ? 'e.g. Mid-size PE-backed healthcare companies, 50-200 employees' : 'e.g. Senior AI Engineer, remote, requires LangChain + production LLM experience'}" style="width:100%;padding:14px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none;resize:vertical;font-family:Arial,sans-serif;margin-bottom:16px">${escHtml(state.agentInput)}</textarea>
    <button id="btn-run-agent" class="find-leads-btn" ${state.agentLoading?'disabled':''} style="background:${a.color}">
      ${state.agentLoading ? '⏳ Thinking...' : '✨ Run Agent'}
    </button>
    ${state.agentError ? `<div style="margin-top:14px;padding:12px 16px;background:var(--red-light);border-radius:8px;color:var(--red);font-size:12px">${state.agentError}</div>` : ''}
  </div>
  ${state.agentOutput ? `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-top:16px;box-shadow:var(--shadow-card)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:14px;color:var(--text)">Output</div>
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
          <label style="font-family:Arial,sans-serif;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Provider</label>
          <select name="provider" style="width:100%;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none">
            <option value="openai" ${getProvider()==='openai'?'selected':''}>OpenAI (GPT-4o-mini)</option>
            <option value="anthropic" ${getProvider()==='anthropic'?'selected':''}>Anthropic (Claude Sonnet)</option>
          </select>
        </div>
        <div style="margin-bottom:8px">
          <label style="font-family:Arial,sans-serif;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">API Key</label>
          <input type="password" name="apiKey" value="${getApiKey()}" placeholder="sk-..." style="width:100%;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;font-family:Arial,sans-serif" />
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:18px;line-height:1.6">
          Get a key at <strong>platform.openai.com/api-keys</strong> or <strong>console.anthropic.com</strong>. Stored only in your browser's local storage — never sent to our servers.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          ${hasApiKey() ? `<button type="button" id="btn-clear-key" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.25);background:var(--red-light);color:var(--red);cursor:pointer;font-family:Arial,sans-serif;font-size:12px">Remove Key</button>` : ''}
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);cursor:pointer;font-family:Arial,sans-serif;font-size:12px">Cancel</button>
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
          return `<div style="display:flex;align-items:center;gap:5px;font-family:Arial,sans-serif;font-size:10px;color:#cfc8ee"><span style="width:8px;height:8px;border-radius:50%;background:${colorMap[type]};display:inline-block;box-shadow:0 0 6px ${colorMap[type]}"></span>${label}</div>`;
        }).join('')}
      </div>
    </div>
    ${selected ? `
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-card)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <span style="font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;color:${selected.color}">${NODE_TYPE_LABELS[selected.type]}</span>
        <button id="btn-close-node-panel" style="background:var(--bg-2);border:1px solid var(--border);border-radius:6px;width:24px;height:24px;cursor:pointer;color:var(--text-3)">✕</button>
      </div>
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:17px;color:var(--text);margin-bottom:6px">${selected.label}</div>
      <div style="font-size:13px;color:var(--text-2)">${selected.sub||''}</div>
    </div>` : ''}
  </div>`;
}

// ── Analytics Events ─────────────────────────────────────────────────
function attachAnalyticsEvents() {
  document.querySelectorAll('[data-analytics-days]').forEach(el => {
    el.addEventListener('click', async () => {
      state.analyticsDays = parseInt(el.dataset.analyticsDays);
      state.analyticsData = await fetchAnalyticsOverview(state.analyticsDays);
      if (state.googleConnected) await fetchGAData();
      app.render();
    });
  });
  document.getElementById('btn-connect-google')?.addEventListener('click', () => {
    const clientId = '557532595072-k4218aj9elu93lmoehoao1qv2shvrq9q.apps.googleusercontent.com';
    const redirectUri = `${location.origin}/api/google-oauth-callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    location.href = authUrl;
  });
  document.getElementById('btn-refresh-ga')?.addEventListener('click', async () => {
    await fetchGAData();
    app.render();
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
    app.render();
  });
}

// ── Agent Events ─────────────────────────────────────────────────────
function attachAgentEvents() {
  document.getElementById('btn-agent-settings')?.addEventListener('click', () => { state.showApiKeyModal = true; app.render(); });
  document.getElementById('btn-agent-settings-2')?.addEventListener('click', () => { state.showApiKeyModal = true; app.render(); });
  document.querySelectorAll('[data-open-agent]').forEach(el => {
    el.addEventListener('click', () => {
      state.activeAgent = el.dataset.openAgent;
      state.agentOutput = ''; state.agentError = null; state.agentInput = '';
      app.render();
    });
  });
  document.getElementById('btn-back-agents')?.addEventListener('click', () => {
    state.activeAgent = null; app.render();
  });
  document.getElementById('btn-run-agent')?.addEventListener('click', async () => {
    const input = document.getElementById('agent-input')?.value || '';
    state.agentInput = input;
    state.agentLoading = true; state.agentError = null; state.agentOutput = '';
    app.render();
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
    app.render();
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
    app.render();
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
    app.render();
    setTimeout(() => { const el = document.getElementById('chat-agent-messages'); if (el) el.scrollTop = el.scrollHeight; }, 50);
  });
}

async function fetchGAData(customFrom, customTo) {
  try {
    let start = `${state.analyticsDays}daysAgo`, end = 'today';
    if (customFrom && customTo) { start = customFrom; end = customTo; }
    const res = await fetch(`/api/ga-data?start=${start}&end=${end}`);
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
  const closeModal = () => { state.showApiKeyModal = false; overlay.remove(); app.render(); };
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
    state.mapSelectedNode = null; app.render();
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
        app.render();
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


export {
  renderAnalyticsView, renderAgentsView, renderMapView, renderApiKeyModal,
  attachAnalyticsEvents, attachAgentEvents, attachMapEvents, attachApiKeyModalEvents,
  fetchGAData,
};
