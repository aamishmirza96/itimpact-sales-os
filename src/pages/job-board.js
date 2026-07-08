// Job Board page — public-facing view of active recruiting positions.
// Mirrors the careers page on the website so the team can see live openings.
import { state, escHtml, app } from '../app-core.js';
import { can } from '../access.js';

// ── Helpers ──────────────────────────────────────────────────────────

function activePositions() {
  const db = state.dbPositions || [];
  return db.filter(p => p.status === 'Active');
}

// Group positions by sector/department
function groupBySector(positions) {
  const map = {};
  for (const p of positions) {
    const key = p.sector || 'General';
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  return map;
}

// ── Render ────────────────────────────────────────────────────────────

export function renderJobBoard() {
  const positions = activePositions();

  return `
  <div class="job-board-wrap">
    <div class="job-board-header">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Open Positions</div>
        <div class="page-title" style="font-size:28px;font-weight:700;color:var(--text)">Current Openings</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${positions.length > 0 ? `<span style="font-size:12px;color:var(--text-3);background:var(--bg-2);border:1px solid var(--border);border-radius:20px;padding:4px 12px">${positions.length} open role${positions.length !== 1 ? 's' : ''}</span>` : ''}
        ${can('recruiting', 'edit') ? `<a href="#recruiting/positions" class="btn-primary" style="text-decoration:none;font-size:12px" onclick="event.preventDefault();window.location.hash='recruiting/positions'">Manage Positions</a>` : ''}
      </div>
    </div>

    ${positions.length === 0 ? `
      <div style="text-align:center;padding:72px 24px;background:var(--bg-1);border:1px solid var(--border);border-radius:14px">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">No open positions right now</div>
        <div style="font-size:13px;color:var(--text-3)">Check back soon — new roles are added regularly.</div>
        ${can('recruiting', 'edit') ? `<a href="#recruiting/positions" onclick="event.preventDefault();window.location.hash='recruiting/positions'" class="btn-primary" style="margin-top:16px;display:inline-block;text-decoration:none">Add Positions →</a>` : ''}
      </div>
    ` : `
      <div class="job-board-list">
        ${positions.map(p => renderJobCard(p)).join('')}
      </div>
    `}
  </div>`;
}

function renderJobCard(p) {
  const tags = [];
  if (p.sector) tags.push({ icon: '🏢', text: p.sector });
  if (p.location) tags.push({ icon: '📍', text: p.location });
  if (p.type) tags.push({ icon: '⏰', text: p.type });

  return `
  <div class="job-card" data-job-id="${p.id}">
    <div class="job-card-body">
      ${p.summary ? `<div class="job-card-company">${escHtml(p.summary)}</div>` : ''}
      <div class="job-card-title">${escHtml(p.title)}</div>
      <div class="job-card-tags">
        ${tags.map(t => `<span class="job-tag"><span class="job-tag-icon">${t.icon}</span>${escHtml(t.text)}</span>`).join('')}
      </div>
    </div>
    <div class="job-card-action">
      <button class="job-view-btn" data-view-job="${p.id}">View Job →</button>
    </div>
  </div>`;
}

// ── Job Detail Panel ──────────────────────────────────────────────────

export function renderJobDetailPanel() {
  const p = state.jobBoardSelected;
  if (!p) return '';

  return `
  <div class="slideover-overlay" id="job-detail-overlay">
    <div class="slideover" id="job-detail-panel" style="width:520px;max-width:95vw">
      <div class="lp-header">
        <div style="flex:1;min-width:0">
          ${p.summary ? `<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);margin-bottom:4px">${escHtml(p.summary)}</div>` : ''}
          <div style="font-size:18px;font-weight:700;color:var(--text);line-height:1.3">${escHtml(p.title)}</div>
        </div>
        <button class="lp-close" id="job-detail-close">✕</button>
      </div>

      <div style="padding:20px 24px;overflow-y:auto;flex:1">
        <!-- Tags -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          ${p.sector ? `<span class="rec-tag" style="background:var(--accent)1a;color:var(--accent);border-color:var(--accent)44">🏢 ${escHtml(p.sector)}</span>` : ''}
          ${p.location ? `<span class="rec-tag">📍 ${escHtml(p.location)}</span>` : ''}
          ${p.type ? `<span class="rec-tag">⏰ ${escHtml(p.type)}</span>` : ''}
          ${p.comp ? `<span class="rec-tag" style="background:var(--green)1a;color:var(--green);border-color:var(--green)44">💰 ${escHtml(p.comp)}</span>` : ''}
        </div>

        ${p.about ? `
        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-3);margin-bottom:8px">About the Role</div>
          <div style="font-size:13px;color:var(--text-2);line-height:1.7;white-space:pre-wrap">${escHtml(p.about)}</div>
        </div>` : ''}

        ${p.summary && !p.about ? `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;color:var(--text-2);line-height:1.7">Working with: ${escHtml(p.summary)}</div>
        </div>` : ''}

        ${p.responsibilities?.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-3);margin-bottom:8px">Responsibilities</div>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
            ${p.responsibilities.map(r => `<li style="font-size:13px;color:var(--text-2);line-height:1.6">${escHtml(r)}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${p.requirements?.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-3);margin-bottom:8px">Requirements</div>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
            ${p.requirements.map(r => `<li style="font-size:13px;color:var(--text-2);line-height:1.6">${escHtml(r)}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${can('recruiting', 'edit') ? `
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:4px;display:flex;gap:8px">
          <a href="#recruiting/positions" onclick="event.preventDefault();window.location.hash='recruiting/positions'" class="btn-ghost" style="text-decoration:none;font-size:12px">Edit in Recruiting →</a>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

// ── Events ────────────────────────────────────────────────────────────

export function attachJobBoardEvents() {
  // View Job button
  document.querySelectorAll('[data-view-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.viewJob;
      state.jobBoardSelected = (state.dbPositions || []).find(p => p.id === id) || null;
      app.render();
    });
  });

  // Close detail panel
  document.getElementById('job-detail-close')?.addEventListener('click', () => {
    state.jobBoardSelected = null;
    app.render();
  });
  document.getElementById('job-detail-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'job-detail-overlay') { state.jobBoardSelected = null; app.render(); }
  });
}
