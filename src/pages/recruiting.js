// Recruiting page: Positions / Candidates / Talent Pool (static seed data)
// plus website-sourced Job Applications, General CVs, AI Assessments, Files.
import { state, candidates, persistCandidate, escHtml, showToast, app } from '../app-core.js';
import { positions, CANDIDATE_STATUSES } from '../recruiting.js';
import { submissionCard, CV_STATUSES, JOBAPP_STATUSES, AI_STATUSES } from './submissions-shared.js';
import { can } from '../access.js';

function renderGeneralCVs() {
  const items = state.generalCVs;
  return `
  <div class="page-header">
    <div>
      <div class="page-title">General CVs</div>
      <div class="page-sub">${items.length} candidate${items.length !== 1 ? 's' : ''} on file</div>
    </div>
    <button class="btn-primary" data-open-add-cv="1">+ Add CV</button>
  </div>
  <div class="rec-cands-list">
    ${items.length === 0 ? '<div class="social-empty">No CVs yet. Click "+ Add CV" to upload one.</div>' : ''}
    ${items.map(s => submissionCard(s, {
      table: 'general_cv_submissions', idPrefix: 'cv-', statusOptions: CV_STATUSES,
      extraFields: [{key:'current_title',label:'Current Role'},{key:'current_company',label:'Company'},{key:'location',label:'Location'}],
      renderDetail: (s) => `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          ${s.linkedin_url ? `<a href="${s.linkedin_url}" target="_blank" class="rec-cv-link">🔗 LinkedIn Profile</a>` : `<span style="font-size:11px;color:var(--text-3)">No LinkedIn provided</span>`}
          ${s.resume_url ? `
            <a href="${s.resume_url}" target="_blank" class="rec-cv-link">👁 View CV</a>
            <a href="${s.resume_url}" download class="rec-cv-link" style="background:var(--accent);color:#fff;border-color:var(--accent)">⬇ Download</a>
          ` : `<span style="font-size:11px;color:var(--red)">⚠ No CV attached</span>`}
          <button class="btn-danger-sm" data-delete-cv="${s.id}">🗑 Delete</button>
        </div>
        ${s.source === 'manual' ? '<span style="font-size:10px;color:var(--text-3);background:var(--bg-2);padding:2px 8px;border-radius:10px">Manually uploaded</span>' : ''}
      `,
    })).join('')}
  </div>
  ${state.showAddCVModal ? renderAddCVModal() : ''}`;
}

function renderAddCVModal() {
  return `
  <div class="modal-overlay" data-close-add-cv="1">
    <div class="modal-box" style="max-width:480px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">Upload CV</div>
        <button class="modal-close" data-close-add-cv="1">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" id="cv-name" placeholder="Jane Smith" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input class="form-input" id="cv-email" type="email" placeholder="jane@example.com" required>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="cv-phone" placeholder="+1 555 0000">
          </div>
          <div class="form-group">
            <label class="form-label">Location</label>
            <input class="form-input" id="cv-location" placeholder="New York, NY">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Current Title</label>
            <input class="form-input" id="cv-title" placeholder="Marketing Manager">
          </div>
          <div class="form-group">
            <label class="form-label">Current Company</label>
            <input class="form-input" id="cv-company" placeholder="Acme Corp">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">CV / Resume File (PDF, DOC, DOCX)</label>
          <input class="form-input" id="cv-file" type="file" accept=".pdf,.doc,.docx" style="padding:8px;cursor:pointer">
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
          <button class="btn-ghost" data-close-add-cv="1">Cancel</button>
          <button class="btn-primary" id="cv-submit-btn" data-submit-add-cv="1">Upload CV</button>
        </div>
      </div>
    </div>
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
      extraFields: [{key:'position_title',label:'Applied for'},{key:'current_title',label:'Current Role'},{key:'current_company',label:'Current Company'},{key:'location',label:'Location'},{key:'expected_salary',label:'Expected Salary'}],
      renderDetail: (s) => `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:12px;color:var(--text-2)">
          <div>Employment Status: <strong>${s.employment_status||'—'}</strong></div>
          <div>Current Salary: <strong>${s.current_salary||'—'}</strong></div>
          <div>Open to Relocation: <strong>${s.open_to_relocation||'—'}</strong></div>
          <div>Open to Remote: <strong>${s.open_to_remote||'—'}</strong></div>
          <div>Current Company: <strong>${s.current_company||'—'}</strong></div>
          <div>Current Title: <strong>${s.current_title||'—'}</strong></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          ${s.linkedin_url ? `<a href="${s.linkedin_url}" target="_blank" class="rec-cv-link">🔗 LinkedIn Profile</a>` : `<span style="font-size:11px;color:var(--text-3)">No LinkedIn provided</span>`}
          ${s.resume_url ? `<a href="${s.resume_url}" target="_blank" class="rec-cv-link">📄 View Resume</a>` : `<span style="font-size:11px;color:var(--red)">⚠ No resume attached</span>`}
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
          <div style="font-weight:800;font-size:32px;color:var(--accent)">${s.overall_score||0}</div>
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

function renderFilesView() {
  const cvFiles = state.generalCVs.filter(c => c.resume_url).map(c => ({ ...c, source: 'General CV', sourceColor: '#8b5cf6' }));
  const jobFiles = state.jobApplications.filter(j => j.resume_url).map(j => ({ ...j, source: j.position_title || 'Job Application', sourceColor: '#06b6d4' }));
  const allFiles = [...cvFiles, ...jobFiles].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  return `
  <div class="page-header">
    <div class="page-title">Files / Resumes</div>
    <div class="page-sub">${allFiles.length} resume${allFiles.length===1?'':'s'} uploaded from website forms</div>
  </div>
  <div class="rec-cands-list">
    ${allFiles.length === 0 ? '<div class="social-empty">No resumes uploaded yet. Resumes will appear here once the website forms are submitted.</div>' : ''}
    ${allFiles.map(f => `
      <div class="rec-cand-card">
        <div class="rec-cand-avatar" style="background:linear-gradient(135deg,${f.sourceColor},${f.sourceColor}cc)">📄</div>
        <div class="rec-cand-body">
          <div class="rec-cand-top">
            <div>
              <div class="rec-cand-name">${f.full_name}</div>
              <div class="rec-cand-role">${f.email}${f.current_title?' · '+f.current_title:''}</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:4px">
                <span style="background:${f.sourceColor}1a;color:${f.sourceColor};padding:2px 8px;border-radius:4px">${f.source}</span>
                · ${new Date(f.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <a href="${f.resume_url}" target="_blank" rel="noopener" style="padding:8px 16px;border-radius:8px;background:var(--accent);color:#fff;text-decoration:none;font-size:11px;font-weight:600;white-space:nowrap">⬇ Download</a>
            </div>
          </div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Recruiting View ───────────────────────────────────────────────────
function statusCfg(id) { return CANDIDATE_STATUSES.find(s=>s.id===id) || CANDIDATE_STATUSES[0]; }

function renderRecruiting() {
  // The old internal rec-tabs bar was replaced by the shell's page tab bar
  // (Recruiting > Positions / Candidates / Talent Pool map onto state.recTab).
  const activePos = state.recPosition || positions[0].id;

  return `
  <div class="page-header">
    <div>
      <div class="page-title">Recruiting</div>
      <div class="page-sub">${positions.filter(p=>p.status==='Active').length} active positions · ${candidates.length} candidates tracked</div>
    </div>
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
        <div class="rec-cand-card" data-open-candidate="${c.id}" style="cursor:pointer">
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
                    ? '<span style="font-size:10px;color:var(--green);">✉ Sent</span>'
                    : '<span style="font-size:10px;color:var(--text-3);">Not sent</span>'}
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

export function attachRecruitingEvents() {
  // Recruiting tabs
  document.querySelectorAll('[data-rectab]').forEach(el => {
    el.addEventListener('click', () => { state.recTab=el.dataset.rectab; app.render(); });
  });
  // Position expand
  document.querySelectorAll('[data-expand-pos]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.expandPos;
      state.recExpandedCandidate = state.recExpandedCandidate===id ? null : id;
      app.render();
    });
  });
  // View candidates button
  document.querySelectorAll('[data-viewcands]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); state.recTab='candidates'; state.recPosition=el.dataset.viewcands; app.render(); });
  });
  // Position filter in candidates tab
  document.querySelectorAll('[data-posfilter]').forEach(el => {
    el.addEventListener('click', () => { state.recPosition=el.dataset.posfilter||null; app.render(); });
  });
  // Candidate status select
  document.querySelectorAll('[data-cand-status]').forEach(sel => {
    sel.addEventListener('change', e => {
      const c = candidates.find(x=>x.id===sel.dataset.candStatus);
      if (c) { c.status=e.target.value; persistCandidate(c); showToast(`${c.name} → ${e.target.value}`); app.render(); }
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

  // Phase 3: card click (not on inline controls) opens the candidate slide-over
  document.querySelectorAll('[data-open-candidate]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button,textarea,select,a,input,label')) return;
      state.candidatePanel = el.dataset.openCandidate;
      app.render();
    });
  });
}

// ── Candidate record slide-over (Phase 3) ─────────────────────────────
function renderCandidatePanel() {
  const c = candidates.find(x => x.id === state.candidatePanel);
  if (!c) return '';
  const st = statusCfg(c.status);
  const pos = positions.find(p => p.id === c.positionId);
  return `
  <div class="slideover" id="candidate-panel">
    <div class="slideover-head">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div class="rec-cand-avatar" style="width:38px;height:38px;font-size:12px">${c.initials}</div>
        <div style="min-width:0">
          <div class="slideover-title">${escHtml(c.name)}</div>
          <div class="slideover-sub">${escHtml(c.currentRole)} · ${escHtml(c.currentCompany)}</div>
        </div>
      </div>
      <button class="modal-close" id="candidate-panel-close">✕</button>
    </div>
    <div class="slideover-body">
      <div class="slideover-section-title">Properties</div>
      <div class="lp-row">
        <label class="lp-label">Status</label>
        <select class="lp-input" id="cp-status" ${can('recruiting','edit')?'':'disabled'}>
          ${CANDIDATE_STATUSES.map(s => `<option value="${s.id}" ${c.status===s.id?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="lp-row"><label class="lp-label">Position</label><div class="lp-static">${pos ? escHtml(pos.title) : '—'}</div></div>
      <div class="lp-row"><label class="lp-label">Location</label><div class="lp-static">${escHtml(c.location || '—')}</div></div>
      <div class="lp-row"><label class="lp-label">Email</label><div class="lp-static">${escHtml(c.email || '—')}</div></div>
      <div class="lp-row">
        <label class="lp-label">Email sent</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2);cursor:pointer">
          <input type="checkbox" id="cp-email-sent" ${c.emailSent?'checked':''} ${can('recruiting','edit')?'':'disabled'} style="accent-color:var(--accent)" /> Outreach email sent to candidate
        </label>
      </div>
      <div class="lp-row">
        <label class="lp-label">Notes</label>
        <textarea class="lp-input" rows="4" id="cp-notes" ${can('recruiting','edit')?'':'disabled'}>${escHtml(c.notes || '')}</textarea>
      </div>

      <div class="slideover-section-title">Summary</div>
      <div style="font-size:12px;color:var(--text-2);line-height:1.7">${escHtml(c.summary || '')}</div>
      ${c.tags?.length ? `<div class="rec-cand-tags" style="margin-top:10px">${c.tags.map(t=>`<span class="rec-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}

      <div class="slideover-section-title">Related</div>
      <a href="${c.driveUrl}" target="_blank" class="rec-cv-link">📄 View CV →</a>
      <span class="cand-status-pill" style="margin-left:8px;background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
    </div>
  </div>`;
}

function attachCandidatePanelEvents() {
  const panel = document.getElementById('candidate-panel');
  if (!panel) return;
  const c = candidates.find(x => x.id === state.candidatePanel);
  const close = () => { state.candidatePanel = null; app.render(); };
  document.getElementById('candidate-panel-close')?.addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', esc); if (state.candidatePanel) close(); }
  });
  document.getElementById('cp-status')?.addEventListener('change', (e) => {
    c.status = e.target.value; persistCandidate(c);
    showToast(`${c.name} → ${e.target.value}`); app.render();
  });
  document.getElementById('cp-email-sent')?.addEventListener('change', (e) => {
    c.emailSent = e.target.checked; persistCandidate(c);
    showToast(e.target.checked ? `✉ Email marked sent — ${c.name}` : `Email unmarked — ${c.name}`);
  });
  document.getElementById('cp-notes')?.addEventListener('input', (e) => {
    c.notes = e.target.value; persistCandidate(c);
  });
}

export { renderRecruiting, renderGeneralCVs, renderJobApplications, renderAIAssessments, renderFilesView, renderCandidatePanel, attachCandidatePanelEvents };
