// Sales page: Apollo prospect pipeline, CRM Leads, Outreach, ICP & Triggers,
// Disqualified. All views/handlers moved verbatim from main.js.
import {
  state, prospects, addedFromSearch, persistProspect, persistAdded,
  bantScore, avgBant, filteredSorted, showToast, checkBackend, searchApolloLeads,
  generateEmail, escHtml, bantBarHTML, stagePillHTML, sourceBadge,
  attachCopyButtons, app,
} from '../app-core.js';
import { STAGES, icpProfile, buyingTriggers, bestClients, apolloFilters, disqualifiers, outreachSequences } from '../data.js';
import { LEAD_STATUSES, fetchLeads, createLead, updateLead, deleteLead } from '../leads.js';

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

  ${state.leadsLoading ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">Loading leads...</div>' : ''}

  <div class="rec-cands-list">
    ${filtered.length === 0 && !state.leadsLoading ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No leads yet. Click "+ New Lead" to add one.</div>' : ''}
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
              ${l.value ? `<div style="font-size:11px;color:var(--green);margin-top:2px">$${l.value.toLocaleString()}</div>` : ''}
            </div>
            <div class="rec-cand-actions">
              <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
              <select class="cand-status-select" data-lead-status="${l.id}" onclick="event.stopPropagation()">
                ${LEAD_STATUSES.map(s=>`<option value="${s.id}" ${l.status===s.id?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${l.notes ? `<div class="rec-cand-summary">${l.notes}</div>` : ''}
          <div style="font-size:10px;color:var(--text-3);margin-top:4px">
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
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Name *</label>
            <input type="text" name="name" required value="${escHtml(l.name||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Company</label>
            <input type="text" name="company" value="${escHtml(l.company||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Email</label>
            <input type="email" name="email" value="${escHtml(l.email||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Phone</label>
            <input type="text" name="phone" value="${escHtml(l.phone||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Value ($)</label>
            <input type="number" name="value" value="${l.value||0}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Source</label>
            <input type="text" name="source" value="${escHtml(l.source||'manual')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Assign To</label>
            <select name="assigned_to" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;">
              <option value="">Unassigned</option>
              ${state.team.map(m => `<option value="${m.id}" ${l.assigned_to===m.id?'selected':''}>${m.full_name||m.email}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Due Date</label>
            <input type="date" name="due_date" value="${l.due_date||''}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Notes</label>
          <textarea name="notes" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;min-height:80px;resize:vertical;">${escHtml(l.notes||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          ${isEdit ? `<button type="button" id="btn-delete-lead" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-size:12px">Delete</button>` : ''}
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-weight:700;font-size:13px">${isEdit?'Save Changes':'Add Lead'}</button>
        </div>
      </form>
    </div>
  </div>`;
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

  const isBoard = state.pipelineView !== 'table';

  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Pipeline</div>
      <div class="page-sub">${prospects.length} prospects · ${priorityCount} priority · ${spokenTo} spoken to · ${meetings} meetings</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <div class="view-switch">
        <button class="view-switch-btn ${isBoard?'active':''}" data-pipe-view="board">Board</button>
        <button class="view-switch-btn ${!isBoard?'active':''}" data-pipe-view="table">Table</button>
      </div>
      <button class="find-leads-btn" id="btn-find-leads">⚡ Find More Leads</button>
    </div>
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

  ${isBoard ? renderPipelineBoard(list) : `
  <table class="prospect-table">
    <thead><tr>
      ${[['name','Prospect'],['company','Company'],['sector','Sector'],['stage','Stage'],['bant','BANT']].map(([col,label]) => `
        <th class="th-sortable ${state.sort===col?'sorted':''}" data-sort-col="${col}">${label}${state.sort===col ? (state.sortDir==='desc'?' ↓':' ↑') : ''}</th>`).join('')}
      <th>Status</th><th>Actions</th><th></th>
    </tr></thead>
    <tbody id="prospect-tbody">
      ${list.map(p=>renderProspectRows(p)).join('')}
    </tbody>
  </table>`}`;
}

// ── Pipeline kanban board (Phase 3) ───────────────────────────────────
function daysInStage(p) {
  if (!p.stageChangedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(p.stageChangedAt).getTime()) / 86400000));
}

function renderPipelineBoard(list) {
  return `
  <div class="kanban">
    ${STAGES.map((label, i) => {
      const cards = list.filter(p => p.stage === i);
      return `
      <div class="kanban-col">
        <div class="kanban-col-head">
          <span class="kanban-col-title">${label}</span>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        <div class="kanban-col-body" data-kb-drop="${i}">
          ${cards.map(p => {
            const d = daysInStage(p);
            return `
            <div class="kanban-card ${p.priority?'priority':''}" draggable="true" data-kb-card="${p.id}" title="Drag to move stage · click for outreach">
              <div class="kanban-card-top">
                <div class="avatar" style="width:26px;height:26px;font-size:9px;border-radius:6px">${p.initials}</div>
                <div class="kanban-card-name">${escHtml(p.name)}${p.priority?' <span class="star">★</span>':''}</div>
              </div>
              <div class="kanban-card-company">${escHtml(p.company)} ${sourceBadge(p.source)}</div>
              ${p.title ? `<div class="kanban-card-title">${escHtml(p.title)}</div>` : ''}
              <div class="kanban-card-foot">
                <span class="kanban-bant">BANT ${bantScore(p.bant)}</span>
                ${p.meetingBooked ? '<span class="mini-badge meeting">📅</span>' : p.spokenTo ? '<span class="mini-badge spoken">📞</span>' : ''}
                ${d != null ? `<span class="kanban-days">${d}d in stage</span>` : ''}
              </div>
            </div>`;
          }).join('')}
          ${cards.length === 0 ? '<div class="kanban-empty">No prospects</div>' : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function attachPipelineBoardEvents() {
  document.querySelectorAll('[data-kb-card]').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.kbCard);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    // Click (not drag) opens the outreach/email modal for the prospect
    card.addEventListener('click', () => {
      const rawId = card.dataset.kbCard;
      state.modal = 'email';
      state.modalData = isNaN(rawId) ? rawId : parseInt(rawId);
      renderModal();
    });
  });
  document.querySelectorAll('[data-kb-drop]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const rawId = e.dataTransfer.getData('text/plain');
      const id = isNaN(rawId) ? rawId : parseInt(rawId);
      const p = prospects.find(x => x.id === id);
      const newStage = parseInt(zone.dataset.kbDrop);
      if (!p || p.stage === newStage) return;
      p.stage = newStage;
      p.stageChangedAt = new Date().toISOString();
      persistProspect(p); // existing update path → localStorage + Supabase
      showToast(`${p.name} → ${STAGES[newStage]}`);
      app.render();
    });
  });
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

export function attachSalesEvents() {
  // Stage filter
  document.querySelectorAll('[data-stage]').forEach(el => {
    el.addEventListener('click', () => { state.stageFilter=parseInt(el.dataset.stage); state.expandedId=null; app.render(); });
  });
  // Sector filter
  document.querySelectorAll('[data-sector]').forEach(el => {
    el.addEventListener('click', () => { state.sectorFilter=el.dataset.sector; state.expandedId=null; app.render(); });
  });
  // Sort
  const ss = document.querySelector('.sort-select');
  if (ss) ss.addEventListener('change', e => { state.sort=e.target.value; state.sortDir='asc'; app.render(); });

  // Board/Table switcher
  document.querySelectorAll('[data-pipe-view]').forEach(el => {
    el.addEventListener('click', () => { state.pipelineView = el.dataset.pipeView; state.expandedId = null; app.render(); });
  });

  // Column-header sorting (table view)
  document.querySelectorAll('[data-sort-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortCol;
      if (state.sort === col) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sort = col; state.sortDir = 'asc'; }
      app.render();
    });
  });

  attachPipelineBoardEvents();

  // Search bar
  const searchInput = document.getElementById('pipeline-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      state.expandedId = null;
      // board mode has no tbody — re-render the whole view (focus is restored below)
      if (state.pipelineView !== 'table') app.render();
      else refreshTbody();
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
      app.render();
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
    app.render();
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
      if (newStage!==p.stage) { p.stage=newStage; p.stageChangedAt=new Date().toISOString(); persistProspect(p); showToast(`${p.name} → ${STAGES[newStage]}`); refreshTbody(); }
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

// ── Lead Events ──────────────────────────────────────────────────────
function attachLeadEvents() {
  document.getElementById('btn-new-lead')?.addEventListener('click', () => {
    state.leadModal = true;
    state.leadEditData = {};
    app.render();
  });
  document.querySelectorAll('[data-lead-filter]').forEach(el => {
    el.addEventListener('click', () => { state.leadFilter = el.dataset.leadFilter; app.render(); });
  });
  document.querySelectorAll('[data-lead-status]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = sel.dataset.leadStatus;
      await updateLead(id, { status: e.target.value });
      state.leads = await fetchLeads();
      showToast('Lead status updated', 'success');
      app.render();
    });
  });
  document.querySelectorAll('[data-edit-lead]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('select')) return;
      // Phase 3: row click opens the record slide-over instead of the edit modal
      const lead = state.leads.find(l => l.id === el.dataset.editLead);
      if (lead) { state.leadPanel = lead.id; app.render(); }
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
    const data = { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), value: parseFloat(fd.get('value'))||0, source: fd.get('source'), notes: fd.get('notes'), assigned_to: fd.get('assigned_to')||null };
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
  app.render();
}

// ── Lead record slide-over (Phase 3) ──────────────────────────────────
// Right-side panel: inline-editable properties (existing updateLead logic),
// activity timeline, related tasks. Close with X or Esc.
function renderLeadPanel() {
  const l = state.leads.find(x => x.id === state.leadPanel);
  if (!l) return '';
  const st = LEAD_STATUSES.find(s => s.id === l.status) || LEAD_STATUSES[0];
  const tasks = state.tasks.filter(t => t.entity_type === 'leads' && t.entity_id === String(l.id));
  const field = (label, name, value, type = 'text') => `
    <div class="lp-row">
      <label class="lp-label">${label}</label>
      <input class="lp-input" type="${type}" data-lp-field="${name}" value="${escHtml(value ?? '')}" />
    </div>`;
  return `
  <div class="slideover" id="lead-panel">
    <div class="slideover-head">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div class="rec-cand-avatar" style="width:38px;height:38px;font-size:12px;background:linear-gradient(135deg,${st.color},${st.color}cc)">${(l.name||'?')[0].toUpperCase()}</div>
        <div style="min-width:0">
          <div class="slideover-title">${escHtml(l.name)}</div>
          <div class="slideover-sub">${escHtml(l.company || 'No company')} · <span style="color:${st.color}">${st.label}</span></div>
        </div>
      </div>
      <button class="modal-close" id="lead-panel-close">✕</button>
    </div>
    <div class="slideover-body">
      <div class="slideover-section-title">Properties</div>
      ${field('Name', 'name', l.name)}
      ${field('Company', 'company', l.company)}
      ${field('Email', 'email', l.email, 'email')}
      ${field('Phone', 'phone', l.phone)}
      ${field('Value ($)', 'value', l.value || 0, 'number')}
      ${field('Source', 'source', l.source)}
      <div class="lp-row">
        <label class="lp-label">Status</label>
        <select class="lp-input" data-lp-field="status">
          ${LEAD_STATUSES.map(s => `<option value="${s.id}" ${l.status===s.id?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="lp-row">
        <label class="lp-label">Assigned to</label>
        <select class="lp-input" data-lp-field="assigned_to">
          <option value="">Unassigned</option>
          ${state.team.map(m => `<option value="${m.id}" ${l.assigned_to===m.id?'selected':''}>${m.full_name||m.email}</option>`).join('')}
        </select>
      </div>
      <div class="lp-row">
        <label class="lp-label">Notes</label>
        <textarea class="lp-input" rows="4" data-lp-field="notes">${escHtml(l.notes || '')}</textarea>
      </div>

      <div class="slideover-section-title">Activity</div>
      <div class="lp-timeline">
        <div class="lp-timeline-item"><span class="lp-timeline-dot"></span>Created ${new Date(l.created_at).toLocaleString()} ${l.creator?.full_name ? 'by ' + escHtml(l.creator.full_name) : ''}</div>
        ${l.updated_at ? `<div class="lp-timeline-item"><span class="lp-timeline-dot"></span>Last updated ${new Date(l.updated_at).toLocaleString()}</div>` : ''}
        ${l.due_date ? `<div class="lp-timeline-item"><span class="lp-timeline-dot" style="background:var(--amber)"></span>Due ${new Date(l.due_date).toLocaleDateString()}</div>` : ''}
      </div>

      <div class="slideover-section-title">Tasks (${tasks.length})</div>
      ${tasks.map(t => {
        const sc = t.status==='completed'?'var(--green)':t.status==='in_progress'?'var(--blue)':'var(--amber)';
        return `<div class="lp-task"><span class="lp-timeline-dot" style="background:${sc}"></span><span style="flex:1">${escHtml(t.title)}</span><span style="font-size:10px;color:var(--text-3)">${t.assignee?.full_name||''}</span></div>`;
      }).join('')}
      <button class="btn-ghost" id="lp-assign-task" style="margin-top:8px;font-size:11px">+ Assign Follow-up</button>
    </div>
    <div class="slideover-foot">
      <button class="btn-danger-sm" id="lp-delete-lead">Delete Lead</button>
    </div>
  </div>`;
}

function attachLeadPanelEvents() {
  const panel = document.getElementById('lead-panel');
  if (!panel) return;
  const lead = state.leads.find(x => x.id === state.leadPanel);
  const close = () => { state.leadPanel = null; app.render(); };
  document.getElementById('lead-panel-close')?.addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', esc); if (state.leadPanel) close(); }
  });
  // Inline property edits persist via the existing updateLead logic
  panel.querySelectorAll('[data-lp-field]').forEach(el => {
    el.addEventListener('change', async () => {
      const f = el.dataset.lpField;
      let v = el.value;
      if (f === 'value') v = parseFloat(v) || 0;
      if (f === 'assigned_to' && !v) v = null;
      try {
        await updateLead(lead.id, { [f]: v });
        state.leads = await fetchLeads();
        showToast('Lead updated', 'success');
        app.render();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });
  });
  document.getElementById('lp-assign-task')?.addEventListener('click', () => {
    state.taskModal = 'new';
    state.taskEditData = null;
    state.taskEntityContext = { entity_type: 'leads', entity_id: String(lead.id), entity_label: lead.name };
    app.render();
  });
  document.getElementById('lp-delete-lead')?.addEventListener('click', async () => {
    if (!confirm('Delete this lead?')) return;
    await deleteLead(lead.id);
    state.leads = await fetchLeads();
    state.leadPanel = null;
    showToast('Lead deleted', 'success');
    app.render();
  });
}

export {
  renderPipeline, renderLeads, renderICP, renderDisqualify, renderOutreach,
  renderModal, renderLeadModal, renderLeadPanel,
  attachLeadEvents, attachLeadModalEvents, attachLeadPanelEvents,
};
