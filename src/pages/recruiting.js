// Recruiting page: Positions / Candidates / Talent Pool
// plus website-sourced Job Applications, General CVs, AI Assessments, Files.
import { state, candidates, persistCandidate, escHtml, showToast, app } from '../app-core.js';
import { positions, CANDIDATE_STATUSES, createDbPosition, updateDbPosition, deleteDbPosition, createDbCandidate, updateDbCandidate, deleteDbCandidate, fetchDbPositions, fetchDbCandidates } from '../recruiting.js';
import { submissionCard, CV_STATUSES, JOBAPP_STATUSES, AI_STATUSES } from './submissions-shared.js';
import { can } from '../access.js';

// Parse "$ 90,000" or "PKR 500,000" into { currency, amount }
function parseSalary(val) {
  const v = (val || '').trim();
  if (v.startsWith('PKR')) return { currency: 'PKR', amount: v.replace(/^PKR\s*/, '') };
  return { currency: '$', amount: v.replace(/^\$\s*/, '') };
}
function salaryInputs(fieldName, candId, isDb, rawVal) {
  const { currency, amount } = parseSalary(rawVal);
  return `<div class="salary-inline-wrap">
    <select class="salary-currency-sel" data-salary-currency="${fieldName}" data-cand-id="${candId}" data-cand-db="${isDb?'1':'0'}">
      <option ${currency==='$'?'selected':''}>$</option>
      <option ${currency==='PKR'?'selected':''}>PKR</option>
    </select>
    <input class="rec-inline-input" data-inline-field="${fieldName}" data-cand-id="${candId}" data-cand-db="${isDb?'1':'0'}" value="${escHtml(amount)}" placeholder="e.g. 90,000" style="flex:1;min-width:0">
  </div>`;
}

// Merge hardcoded + DB positions/candidates
function allPositions() {
  return state.recruitingDbReady ? state.dbPositions : positions;
}
function allCandidates() {
  const dbC = state.dbCandidates.map(c => ({
    ...c, positionId: c.position_id, currentRole: c.candidate_role || c.current_role,
    currentCompany: c.candidate_company || c.current_company, emailSent: c.email_sent,
    currentSalary: c.current_salary, desiredSalary: c.desired_salary,
    driveUrl: c.drive_url, isDb: true,
  }));
  if (state.recruitingDbReady) return dbC;
  return [...candidates, ...dbC];
}

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
const STATUS_COLORS = { Active:'#10b981', Paused:'#f59e0b', Closed:'#ef4444' };

function renderRecruiting() {
  const pos = allPositions();
  const cands = allCandidates();
  const usingDb = state.recruitingDbReady;
  return `
  <div class="page-header">
    <div>
      <div class="page-title">Recruiting</div>
      <div class="page-sub">${pos.filter(p=>p.status==='Active').length} active positions · ${cands.length} candidates tracked</div>
    </div>
    <div style="display:flex;gap:8px">
      ${state.recTab==='positions' ? `<button class="btn-primary" id="btn-add-position">+ Add Position</button>` : ''}
      ${state.recTab==='candidates' ? `
        <button class="btn-ghost" id="btn-drive-import" style="display:flex;align-items:center;gap:5px">📁 From Drive</button>
        <button class="btn-primary" id="btn-add-candidate">+ Add Candidate</button>` : ''}
      ${state.recTab==='pool' ? `<button class="btn-primary" id="btn-add-candidate-pool">+ Add Candidate</button>` : ''}
    </div>
  </div>
  ${!usingDb ? `<div style="background:#f59e0b1a;border:1px solid #f59e0b44;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:16px">
    Run <strong>supabase-recruiting.sql</strong> in Supabase to enable add/delete/edit for positions and candidates.
  </div>` : ''}
  ${state.recTab==='positions' ? renderPositionsTab() : ''}
  ${state.recTab==='candidates' ? renderCandidatesTab() : ''}
  ${state.recTab==='pool' ? renderTalentPoolTab() : ''}
  ${state.positionModal ? renderPositionModal() : ''}
  ${state.candidateModal ? renderCandidateModal() : ''}
  ${state.driveImportModal !== null ? renderDriveImportModal() : ''}`;
}

function renderPositionsTab() {
  const pos = allPositions();
  const cands = allCandidates();
  return `
  <div class="rec-positions-grid">
    ${pos.map(p => {
      const posCands = cands.filter(c=>c.positionId===p.id || c.position_id===p.id);
      const shortlisted = posCands.filter(c=>c.status==='shortlisted').length;
      const emailSent = posCands.filter(c=>c.emailSent||c.email_sent).length;
      const isExpanded = state.recExpandedCandidate === p.id;
      const statusColor = STATUS_COLORS[p.status] || '#10b981';
      const driveUrl = p.driveUrl || p.drive_url || '';
      return `
      <div class="rec-pos-card ${p.priority?'priority-pos':''}">
        <div class="rec-pos-header" data-expand-pos="${p.id}">
          <div class="rec-pos-left">
            <div class="rec-pos-title">${escHtml(p.title)}</div>
            <div class="rec-pos-meta">${escHtml(p.location||'')}${p.comp?' · '+escHtml(p.comp):''}</div>
          </div>
          <div class="rec-pos-badges">
            <select class="pos-status-select" data-pos-status="${p.id}" style="font-size:10px;padding:3px 8px;border-radius:12px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;cursor:pointer" onclick="event.stopPropagation()">
              <option value="Active" ${p.status==='Active'?'selected':''}>● Active</option>
              <option value="Paused" ${p.status==='Paused'?'selected':''}>⏸ Paused</option>
              <option value="Closed" ${p.status==='Closed'?'selected':''}>✕ Closed</option>
            </select>
            <span class="rec-pos-stat">${posCands.length} CVs</span>
            <span class="rec-pos-stat green">${shortlisted} shortlisted</span>
            <span class="rec-pos-stat indigo">${emailSent} emailed</span>
            ${p.isDb || state.dbPositions.length > 0 ? `<button class="btn-danger-sm" data-delete-pos="${p.id}" onclick="event.stopPropagation()" style="font-size:10px;padding:3px 8px">🗑</button>` : ''}
            ${p.isDb || state.dbPositions.length > 0 ? `<button class="btn-ghost" style="font-size:10px;padding:3px 8px" data-edit-pos="${p.id}" onclick="event.stopPropagation()">Edit</button>` : ''}
            <span class="rec-chevron ${isExpanded?'open':''}">▾</span>
          </div>
        </div>
        ${isExpanded ? `
        <div class="rec-pos-body">
          ${p.about||p.summary ? `<div class="rec-pos-section-title">About</div><div class="rec-pos-text">${escHtml(p.about||p.summary||'')}</div>` : ''}
          ${((p.responsibilities||[]).length || (p.requirements||[]).length) ? `
          <div class="rec-two-col" style="margin-top:14px">
            ${(p.responsibilities||[]).length ? `<div><div class="rec-pos-section-title">Key Responsibilities</div><ul class="rec-list">${(p.responsibilities||[]).map(r=>`<li>${escHtml(r)}</li>`).join('')}</ul></div>` : ''}
            ${(p.requirements||[]).length ? `<div><div class="rec-pos-section-title">Requirements</div><ul class="rec-list">${(p.requirements||[]).map(r=>`<li>${escHtml(r)}</li>`).join('')}</ul></div>` : ''}
          </div>` : ''}
          <div class="rec-pos-footer">
            ${driveUrl ? `<a href="${driveUrl}" target="_blank" class="rec-drive-link">📁 Open in Google Drive →</a>` : ''}
            <button class="rec-drive-add-btn btn-ghost" data-drive-import-pos="${p.id}" style="font-size:11px;padding:5px 12px">📁 Add CV from Drive</button>
            <button class="rec-view-cands-btn" data-viewcands="${p.id}">View ${posCands.length} Candidates →</button>
          </div>
          ${posCands.length ? `
          <div class="rec-pos-section-title" style="margin-top:18px">Candidates for this role</div>
          <div class="rec-mini-cand-list">
            ${posCands.map(c => {
              const st = statusCfg(c.status);
              return `<div class="rec-mini-cand">
                <div class="rec-mini-avatar">${c.initials||'?'}</div>
                <div class="rec-mini-info">
                  <div class="rec-mini-name">${escHtml(c.name)}</div>
                  <div class="rec-mini-role">${escHtml(c.currentRole||c.current_role||'')} · ${escHtml(c.currentCompany||c.current_company||'')}</div>
                </div>
                <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
                ${(c.emailSent||c.email_sent)?'<span class="email-sent-badge">✉ Sent</span>':'<span class="email-not-sent-badge">✉ Not sent</span>'}
                ${(c.driveUrl||c.drive_url)?`<a href="${c.driveUrl||c.drive_url}" target="_blank" class="rec-cv-link">CV →</a>`:''}
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderCandidatesTab() {
  const pos = allPositions();
  const cands = allCandidates();
  const posFilter = state.recPosition;
  const list = posFilter ? cands.filter(c=>(c.positionId||c.position_id)===posFilter) : cands;

  return `
  <div class="rec-cands-layout">
    <div class="rec-pos-sidebar">
      <div class="rec-pos-sidebar-label">Filter by Position</div>
      <button class="rec-pos-filter-btn ${!posFilter?'active':''}" data-posfilter="">All (${cands.length})</button>
      ${pos.map(p=>`
        <button class="rec-pos-filter-btn ${posFilter===p.id?'active':''}" data-posfilter="${p.id}">
          ${escHtml(p.title)} <span style="color:var(--text-3)">(${cands.filter(c=>(c.positionId||c.position_id)===p.id).length})</span>
        </button>`).join('')}
    </div>
    <div class="rec-cands-list">
      ${list.length===0 ? '<div class="social-empty">No candidates yet. Click "+ Add Candidate" to add one.</div>' : ''}
      ${list.map(c => {
        const st = statusCfg(c.status);
        const p = pos.find(p=>p.id===(c.positionId||c.position_id));
        const driveUrl = c.driveUrl||c.drive_url||'';
        return `
        <div class="rec-cand-card" data-open-candidate="${c.id}" style="cursor:pointer">
          <div class="rec-cand-avatar">${c.initials||'?'}</div>
          <div class="rec-cand-body">
            <div class="rec-cand-top">
              <div>
                <div class="rec-cand-name">${escHtml(c.name)}</div>
                <div class="rec-cand-role">${escHtml(c.currentRole||c.current_role||'')} · ${escHtml(c.currentCompany||c.current_company||'')}</div>
                <div class="rec-cand-loc">📍 ${escHtml(c.location||'—')} ${p?`· <span class="rec-pos-tag">${escHtml(p.title)}</span>`:''}
                ${(c.currentSalary||c.current_salary)?`<span style="color:var(--text-3);margin-left:8px">Current: ${escHtml(c.currentSalary||c.current_salary)}</span>`:''}
                ${(c.desiredSalary||c.desired_salary)?`<span style="color:var(--green);margin-left:8px">Desired: ${escHtml(c.desiredSalary||c.desired_salary)}</span>`:''}
                </div>
              </div>
              <div class="rec-cand-actions">
                <span class="cand-status-pill" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
                <select class="cand-status-select" data-cand-status="${c.id}" data-cand-db="${c.isDb?'1':'0'}">
                  ${CANDIDATE_STATUSES.map(s=>`<option value="${s.id}" ${c.status===s.id?'selected':''}>${s.label}</option>`).join('')}
                </select>
                <button class="btn-ghost" style="font-size:10px;padding:3px 8px" data-edit-cand="${c.id}" onclick="event.stopPropagation()">Edit</button>
                <button class="btn-danger-sm" data-delete-cand="${c.id}" data-cand-db="${c.isDb?'1':'0'}" onclick="event.stopPropagation()">🗑</button>
              </div>
            </div>
            ${c.summary?`<div class="rec-cand-summary">${escHtml(c.summary)}</div>`:''}
            ${(c.tags||[]).length?`<div class="rec-cand-tags">${(c.tags||[]).map(t=>`<span class="rec-tag">${escHtml(t)}</span>`).join('')}</div>`:''}
            <div class="rec-inline-fields" onclick="event.stopPropagation()">
              <div class="rec-inline-row">
                <div class="rec-inline-group">
                  <label class="rec-inline-label">Current Role</label>
                  <input class="rec-inline-input" data-inline-field="candidate_role" data-cand-id="${c.id}" data-cand-db="${c.isDb?'1':'0'}" value="${escHtml(c.currentRole||c.current_role||'')}" placeholder="e.g. Sales Manager">
                </div>
                <div class="rec-inline-group">
                  <label class="rec-inline-label">Location</label>
                  <input class="rec-inline-input" data-inline-field="location" data-cand-id="${c.id}" data-cand-db="${c.isDb?'1':'0'}" value="${escHtml(c.location||'')}" placeholder="e.g. New York">
                </div>
              </div>
              <div class="rec-inline-row">
                <div class="rec-inline-group">
                  <label class="rec-inline-label">Current Salary</label>
                  ${salaryInputs('current_salary', c.id, c.isDb, c.currentSalary||c.current_salary||'')}
                </div>
                <div class="rec-inline-group">
                  <label class="rec-inline-label">Desired Salary</label>
                  ${salaryInputs('desired_salary', c.id, c.isDb, c.desiredSalary||c.desired_salary||'')}
                </div>
              </div>
            </div>
            <div class="rec-cand-footer">
              <label class="email-toggle">
                <input type="checkbox" data-email-toggle="${c.id}" data-cand-db="${c.isDb?'1':'0'}" ${(c.emailSent||c.email_sent)?'checked':''}>
                <span>Email sent to candidate</span>
              </label>
              ${c.email?`<span class="rec-email">${escHtml(c.email)}</span>`:''}
              ${driveUrl?`<a href="${driveUrl}" target="_blank" class="rec-cv-link">📄 View CV →</a>`:''}
            </div>
            <textarea class="rec-notes-area" data-rec-notes="${c.id}" data-cand-db="${c.isDb?'1':'0'}" placeholder="Add notes…">${escHtml(c.notes||'')}</textarea>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderTalentPoolTab() {
  const pos = allPositions();
  const cands = allCandidates();
  const byPos = {};
  pos.forEach(p => { byPos[p.id] = cands.filter(c=>(c.positionId||c.position_id)===p.id); });

  return `
  <div class="talent-pool">
    <div class="talent-pool-header">
      <div class="talent-pool-stats">
        <div class="metric-card" style="display:inline-flex;flex-direction:column;margin-right:10px">
          <div class="metric-label">Total CVs</div><div class="metric-value">${cands.length}</div>
        </div>
        <div class="metric-card" style="display:inline-flex;flex-direction:column;margin-right:10px">
          <div class="metric-label">Shortlisted</div><div class="metric-value green">${cands.filter(c=>c.status==='shortlisted').length}</div>
        </div>
        <div class="metric-card" style="display:inline-flex;flex-direction:column">
          <div class="metric-label">Emails Sent</div><div class="metric-value accent">${cands.filter(c=>c.emailSent||c.email_sent).length}</div>
        </div>
      </div>
    </div>
    ${pos.map(p => {
      const posCands = byPos[p.id] || [];
      if (!posCands.length) return '';
      return `
      <div class="talent-pool-section">
        <div class="talent-pool-pos-header">
          <span class="talent-pool-pos-title">${escHtml(p.title)}</span>
          <span class="talent-pool-pos-count">${posCands.length} candidates</span>
          <span class="talent-pool-pos-short">${posCands.filter(c=>c.status==='shortlisted'||c.status==='interview'||c.status==='hired').length} progressed</span>
        </div>
        <table class="talent-pool-table">
          <thead><tr><th>Name</th><th>Current Role</th><th>Location</th><th>Current Salary</th><th>Desired Salary</th><th>Status</th><th>CV</th><th></th></tr></thead>
          <tbody>
            ${posCands.map(c => {
              const st = statusCfg(c.status);
              return `<tr>
                <td><div style="display:flex;align-items:center;gap:8px">
                  <div class="rec-mini-avatar" style="width:28px;height:28px;font-size:9px">${c.initials||'?'}</div>
                  <span style="font-weight:500;font-size:12px">${escHtml(c.name)}</span>
                </div></td>
                <td><input class="pool-inline-input" data-inline-field="candidate_role" data-cand-id="${c.id}" data-cand-db="${c.isDb?'1':'0'}" value="${escHtml(c.currentRole||c.current_role||'')}" placeholder="—"></td>
                <td><input class="pool-inline-input" data-inline-field="location" data-cand-id="${c.id}" data-cand-db="${c.isDb?'1':'0'}" value="${escHtml(c.location||'')}" placeholder="—"></td>
                <td>${salaryInputs('current_salary', c.id, c.isDb, c.currentSalary||c.current_salary||'')}</td>
                <td>${salaryInputs('desired_salary', c.id, c.isDb, c.desiredSalary||c.desired_salary||'')}</td>
                <td><select class="cand-status-select" data-cand-status="${c.id}" data-cand-db="${c.isDb?'1':'0'}" style="font-size:10px;padding:3px 6px;border-radius:8px;border:1px solid var(--border);background:${st.color}22;color:${st.color}">
                  ${CANDIDATE_STATUSES.map(s=>`<option value="${s.id}" ${c.status===s.id?'selected':''}>${s.label}</option>`).join('')}
                </select></td>
                <td>${(c.driveUrl||c.drive_url)?`<a href="${c.driveUrl||c.drive_url}" target="_blank" class="rec-cv-link">View →</a>`:''}</td>
                <td><button class="btn-danger-sm" data-delete-cand="${c.id}" data-cand-db="${c.isDb?'1':'0'}" style="font-size:10px;padding:2px 6px">🗑</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Drive Import Modal ────────────────────────────────────────────────
function renderDriveImportModal() {
  const pos = allPositions();
  const preselected = state.driveImportModal?.positionId || '';
  return `
  <div class="modal-overlay" id="drive-import-overlay">
    <div class="modal-box" style="max-width:460px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">📁 Add Candidate from Google Drive</div>
        <button class="modal-close" id="drive-import-close">✕</button>
      </div>
      <form id="drive-import-form" style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
        <div class="form-group">
          <label class="form-label">Google Drive CV Link *</label>
          <input class="form-input" id="drive-import-url" name="drive_url"
            placeholder="https://drive.google.com/file/d/…/view" required autofocus
            style="border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow)">
          <div style="font-size:10px;color:var(--text-3);margin-top:4px">Paste the shareable link from your Drive folder</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Candidate Name *</label>
            <input class="form-input" name="name" placeholder="Jane Smith" required>
          </div>
          <div class="form-group">
            <label class="form-label">Position</label>
            <select class="form-input" name="position_id">
              <option value="">— No position —</option>
              ${pos.map(p=>`<option value="${p.id}" ${preselected===p.id?'selected':''}>${escHtml(p.title)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-input" name="status">
            ${CANDIDATE_STATUSES.map(s=>`<option value="${s.id}" ${s.id==='new'?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
          <button type="button" class="btn-ghost" id="drive-import-cancel">Cancel</button>
          <button type="submit" class="btn-primary" id="drive-import-submit">Add Candidate</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Position Modal ────────────────────────────────────────────────────
function renderPositionModal() {
  const p = state.positionEditData || {};
  const isEdit = !!p.id;
  return `
  <div class="modal-overlay" id="pos-modal-overlay">
    <div class="modal-box" style="max-width:580px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Position' : 'Add New Position'}</div>
        <button class="modal-close" id="pos-modal-close">✕</button>
      </div>
      <form id="pos-form" style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Job Title *</label>
            <input class="form-input" name="title" value="${escHtml(p.title||'')}" placeholder="e.g. Senior Engineer" required>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-input" name="type">
              <option ${(p.type||'Full Time')==='Full Time'?'selected':''}>Full Time</option>
              <option ${p.type==='Part Time'?'selected':''}>Part Time</option>
              <option ${p.type==='Contract'?'selected':''}>Contract</option>
              <option ${p.type==='Freelance'?'selected':''}>Freelance</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Location</label>
            <input class="form-input" name="location" value="${escHtml(p.location||p.location||'')}" placeholder="e.g. Remote — US">
          </div>
          <div class="form-group">
            <label class="form-label">Compensation</label>
            <input class="form-input" name="comp" value="${escHtml(p.comp||'')}" placeholder="e.g. $80,000–$100,000">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Sector</label>
            <input class="form-input" name="sector" value="${escHtml(p.sector||'')}" placeholder="e.g. Healthcare">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-input" name="status">
              <option ${(p.status||'Active')==='Active'?'selected':''}>Active</option>
              <option ${p.status==='Paused'?'selected':''}>Paused</option>
              <option ${p.status==='Closed'?'selected':''}>Closed</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Summary / About</label>
          <textarea class="form-input" name="summary" rows="3" placeholder="Brief description of the role…">${escHtml(p.summary||p.about||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Google Drive Link (JD folder)</label>
          <input class="form-input" name="drive_url" value="${escHtml(p.drive_url||p.driveUrl||'')}" placeholder="https://drive.google.com/…">
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
          <button type="button" class="btn-ghost" id="pos-modal-cancel">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Add Position'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Candidate Modal ────────────────────────────────────────────────────
function renderCandidateModal() {
  const c = state.candidateEditData || {};
  const isEdit = !!c.id;
  const pos = allPositions();
  return `
  <div class="modal-overlay" id="cand-modal-overlay">
    <div class="modal-box" style="max-width:580px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Candidate' : 'Add New Candidate'}</div>
        <button class="modal-close" id="cand-modal-close">✕</button>
      </div>
      <form id="cand-form" style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" name="name" value="${escHtml(c.name||'')}" placeholder="Jane Smith" required>
          </div>
          <div class="form-group">
            <label class="form-label">Position</label>
            <select class="form-input" name="position_id">
              <option value="">— No position —</option>
              ${pos.map(p=>`<option value="${p.id}" ${(c.position_id||c.positionId)===p.id?'selected':''}>${escHtml(p.title)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Current Role</label>
            <input class="form-input" name="current_role" value="${escHtml(c.current_role||c.currentRole||'')}" placeholder="Senior Manager">
          </div>
          <div class="form-group">
            <label class="form-label">Current Company</label>
            <input class="form-input" name="current_company" value="${escHtml(c.current_company||c.currentCompany||'')}" placeholder="Acme Corp">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Location</label>
            <input class="form-input" name="location" value="${escHtml(c.location||'')}" placeholder="New York, NY">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" name="email" type="email" value="${escHtml(c.email||'')}" placeholder="jane@example.com">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Current Salary</label>
            <input class="form-input" name="current_salary" value="${escHtml(c.current_salary||c.currentSalary||'')}" placeholder="e.g. $90,000">
          </div>
          <div class="form-group">
            <label class="form-label">Desired Salary</label>
            <input class="form-input" name="desired_salary" value="${escHtml(c.desired_salary||c.desiredSalary||'')}" placeholder="e.g. $110,000">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">LinkedIn URL</label>
            <input class="form-input" name="linkedin" value="${escHtml(c.linkedin||'')}" placeholder="linkedin.com/in/…">
          </div>
          <div class="form-group">
            <label class="form-label">CV / Drive Link</label>
            <input class="form-input" name="drive_url" value="${escHtml(c.drive_url||c.driveUrl||'')}" placeholder="https://drive.google.com/…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-input" name="status">
            ${CANDIDATE_STATUSES.map(s=>`<option value="${s.id}" ${(c.status||'new')===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Summary / Experience</label>
          <textarea class="form-input" name="summary" rows="3" placeholder="Brief profile summary…">${escHtml(c.summary||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-input" name="notes" rows="2" placeholder="Internal notes…">${escHtml(c.notes||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
          <button type="button" class="btn-ghost" id="cand-modal-cancel">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Add Candidate'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

export function attachRecruitingEvents() {
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
  // Position status change
  document.querySelectorAll('[data-pos-status]').forEach(sel => {
    sel.addEventListener('change', async e => {
      const id = sel.dataset.posStatus;
      const p = state.dbPositions.find(x=>x.id===id);
      if (p) {
        p.status = e.target.value;
        try { await updateDbPosition(id, { status: e.target.value }); showToast(`Position → ${e.target.value}`, 'success'); app.render(); }
        catch(err) { showToast('Error: ' + err.message, 'error'); }
      }
    });
  });
  // Delete position
  document.querySelectorAll('[data-delete-pos]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this position? This cannot be undone.')) return;
      try {
        await deleteDbPosition(btn.dataset.deletePos);
        state.dbPositions = (await fetchDbPositions()).rows;
        showToast('Position deleted', 'success'); app.render();
      } catch(err) { showToast('Error: ' + err.message, 'error'); }
    });
  });
  // Edit position
  document.querySelectorAll('[data-edit-pos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = state.dbPositions.find(x=>x.id===btn.dataset.editPos);
      if (p) { state.positionModal = 'edit'; state.positionEditData = { ...p }; app.render(); }
    });
  });
  // Add position button
  document.getElementById('btn-add-position')?.addEventListener('click', () => {
    state.positionModal = 'new'; state.positionEditData = {}; app.render();
  });
  // Position modal events
  const posCancelClose = () => { state.positionModal = null; state.positionEditData = null; app.render(); };
  document.getElementById('pos-modal-close')?.addEventListener('click', posCancelClose);
  document.getElementById('pos-modal-cancel')?.addEventListener('click', posCancelClose);
  document.getElementById('pos-modal-overlay')?.addEventListener('click', e => { if (e.target.id==='pos-modal-overlay') posCancelClose(); });
  document.getElementById('pos-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { title: fd.get('title'), type: fd.get('type'), location: fd.get('location'), comp: fd.get('comp'), sector: fd.get('sector'), status: fd.get('status'), summary: fd.get('summary'), drive_url: fd.get('drive_url') };
    try {
      if (state.positionEditData?.id) { await updateDbPosition(state.positionEditData.id, data); showToast('Position updated ✓', 'success'); }
      else { await createDbPosition(data); showToast('Position added ✓', 'success'); }
      state.dbPositions = (await fetchDbPositions()).rows;
      state.positionModal = null; state.positionEditData = null; app.render();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  });

  // Add candidate button
  const openCandModal = () => { state.candidateModal = 'new'; state.candidateEditData = {}; app.render(); };
  document.getElementById('btn-add-candidate')?.addEventListener('click', openCandModal);
  document.getElementById('btn-add-candidate-pool')?.addEventListener('click', openCandModal);
  // Edit candidate
  document.querySelectorAll('[data-edit-cand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editCand;
      const c = allCandidates().find(x=>x.id===id);
      if (c) { state.candidateModal = 'edit'; state.candidateEditData = { ...c }; app.render(); }
    });
  });
  // Delete candidate
  document.querySelectorAll('[data-delete-cand]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this candidate?')) return;
      const id = btn.dataset.deleteCand;
      const isDb = btn.dataset.candDb === '1';
      try {
        if (isDb) { await deleteDbCandidate(id); state.dbCandidates = (await fetchDbCandidates()).rows; }
        else { showToast('Hardcoded candidates can only be deleted after migrating to DB. Run supabase-recruiting.sql first.', 'error'); return; }
        showToast('Candidate deleted', 'success'); app.render();
      } catch(err) { showToast('Error: ' + err.message, 'error'); }
    });
  });
  // Candidate modal events
  const candCancelClose = () => { state.candidateModal = null; state.candidateEditData = null; app.render(); };
  document.getElementById('cand-modal-close')?.addEventListener('click', candCancelClose);
  document.getElementById('cand-modal-cancel')?.addEventListener('click', candCancelClose);
  document.getElementById('cand-modal-overlay')?.addEventListener('click', e => { if (e.target.id==='cand-modal-overlay') candCancelClose(); });
  document.getElementById('cand-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), position_id: fd.get('position_id')||null,
      candidate_role: fd.get('current_role'), candidate_company: fd.get('current_company'),
      location: fd.get('location'), email: fd.get('email'),
      current_salary: fd.get('current_salary'), desired_salary: fd.get('desired_salary'),
      linkedin: fd.get('linkedin'), drive_url: fd.get('drive_url'),
      status: fd.get('status'), summary: fd.get('summary'), notes: fd.get('notes'),
    };
    try {
      if (state.candidateEditData?.id && state.candidateEditData?.isDb) {
        await updateDbCandidate(state.candidateEditData.id, data); showToast('Candidate updated ✓', 'success');
      } else { await createDbCandidate(data); showToast('Candidate added ✓', 'success'); }
      state.dbCandidates = (await fetchDbCandidates()).rows;
      state.candidateModal = null; state.candidateEditData = null; app.render();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  });

  // Candidate status select
  document.querySelectorAll('[data-cand-status]').forEach(sel => {
    sel.addEventListener('change', async e => {
      const id = sel.dataset.candStatus;
      const isDb = sel.dataset.candDb === '1';
      if (isDb) {
        const c = state.dbCandidates.find(x=>x.id===id);
        if (c) { c.status = e.target.value; await updateDbCandidate(id, { status: e.target.value }); showToast(`Status updated`, 'success'); app.render(); }
      } else {
        const c = candidates.find(x=>x.id===id);
        if (c) { c.status=e.target.value; persistCandidate(c); showToast(`${c.name} → ${e.target.value}`); app.render(); }
      }
    });
  });
  // Email sent toggle
  document.querySelectorAll('[data-email-toggle]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const id = cb.dataset.emailToggle;
      const isDb = cb.dataset.candDb === '1';
      if (isDb) {
        const c = state.dbCandidates.find(x=>x.id===id);
        if (c) { c.email_sent = cb.checked; await updateDbCandidate(id, { email_sent: cb.checked }); showToast(cb.checked?`✉ Email marked sent`:`Email unmarked`); }
      } else {
        const c = candidates.find(x=>x.id===id);
        if (c) { c.emailSent=cb.checked; persistCandidate(c); showToast(cb.checked?`✉ Email marked sent — ${c.name}`:`Email unmarked — ${c.name}`); }
      }
    });
  });
  // ── Inline field edits (Current Role, Location, Salary) ─────────────
  async function saveInlineField(candId, isDb, fieldName, value) {
    if (!isDb) return;
    const c = state.dbCandidates.find(x => x.id === candId);
    if (!c) return;
    c[fieldName] = value;
    try { await updateDbCandidate(candId, { [fieldName]: value }); }
    catch(err) { showToast('Save failed: ' + err.message, 'error'); }
  }
  // Merge currency + amount then save
  function mergeSalary(amountInput) {
    const candId = amountInput.dataset.candId;
    const isDb = amountInput.dataset.candDb === '1';
    const fieldName = amountInput.dataset.inlineField;
    const currSel = amountInput.closest('.salary-inline-wrap')?.querySelector('.salary-currency-sel');
    const currency = currSel ? currSel.value : '$';
    const amount = amountInput.value.trim();
    const combined = amount ? `${currency} ${amount}` : '';
    saveInlineField(candId, isDb, fieldName, combined);
  }
  document.querySelectorAll('[data-inline-field]').forEach(input => {
    if (input.tagName !== 'INPUT') return;
    const isSalary = ['current_salary','desired_salary'].includes(input.dataset.inlineField);
    if (isSalary) {
      input.addEventListener('blur', () => mergeSalary(input));
    } else {
      input.addEventListener('blur', () => {
        saveInlineField(input.dataset.candId, input.dataset.candDb === '1', input.dataset.inlineField, input.value.trim());
      });
    }
  });
  document.querySelectorAll('.salary-currency-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const amountInput = sel.closest('.salary-inline-wrap')?.querySelector('[data-inline-field]');
      if (amountInput) mergeSalary(amountInput);
    });
  });

  // Candidate notes
  document.querySelectorAll('[data-rec-notes]').forEach(ta => {
    ta.addEventListener('input', async () => {
      const id = ta.dataset.recNotes;
      const isDb = ta.dataset.candDb === '1';
      if (isDb) {
        const c = state.dbCandidates.find(x=>x.id===id);
        if (c) { c.notes = ta.value; await updateDbCandidate(id, { notes: ta.value }); }
      } else {
        const c = candidates.find(x=>x.id===id);
        if (c) { c.notes=ta.value; persistCandidate(c); }
      }
    });
  });
  // Card click opens slide-over
  document.querySelectorAll('[data-open-candidate]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button,textarea,select,a,input,label')) return;
      state.candidatePanel = el.dataset.openCandidate;
      app.render();
    });
  });

  // ── Drive Import Modal ────────────────────────────────────────────
  // Open from candidates tab header button
  document.getElementById('btn-drive-import')?.addEventListener('click', () => {
    state.driveImportModal = { positionId: state.recPosition || '' };
    app.render();
    setTimeout(() => document.getElementById('drive-import-url')?.focus(), 50);
  });
  // Open from position card footer button (pre-selects position)
  document.querySelectorAll('[data-drive-import-pos]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.driveImportModal = { positionId: btn.dataset.driveImportPos };
      app.render();
      setTimeout(() => document.getElementById('drive-import-url')?.focus(), 50);
    });
  });
  // Close
  const closeDriveModal = () => { state.driveImportModal = null; app.render(); };
  document.getElementById('drive-import-close')?.addEventListener('click', closeDriveModal);
  document.getElementById('drive-import-cancel')?.addEventListener('click', closeDriveModal);
  document.getElementById('drive-import-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'drive-import-overlay') closeDriveModal();
  });
  // Submit
  document.getElementById('drive-import-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    const drive_url = (fd.get('drive_url') || '').trim();
    if (!name || !drive_url) { showToast('Name and Drive link are required', 'error'); return; }
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const data = {
      name, initials,
      position_id: fd.get('position_id') || null,
      status: fd.get('status') || 'new',
      drive_url,
    };
    const btn = document.getElementById('drive-import-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    try {
      await createDbCandidate(data);
      state.dbCandidates = (await fetchDbCandidates()).rows;
      state.driveImportModal = null;
      showToast(`${name} added ✓`, 'success');
      app.render();
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Add Candidate'; }
    }
  });
}

// ── Candidate record slide-over ────────────────────────────────────────
function renderCandidatePanel() {
  const allC = allCandidates();
  const c = allC.find(x => x.id === state.candidatePanel);
  if (!c) return '';
  const st = statusCfg(c.status);
  const pos = allPositions().find(p => p.id === (c.positionId||c.position_id));
  const driveUrl = c.driveUrl||c.drive_url||'';
  const emailSent = c.emailSent||c.email_sent;
  return `
  <div class="slideover" id="candidate-panel">
    <div class="slideover-head">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div class="rec-cand-avatar" style="width:38px;height:38px;font-size:12px">${c.initials||'?'}</div>
        <div style="min-width:0">
          <div class="slideover-title">${escHtml(c.name)}</div>
          <div class="slideover-sub">${escHtml(c.currentRole||c.current_role||'')} · ${escHtml(c.currentCompany||c.current_company||'')}</div>
        </div>
      </div>
      <button class="modal-close" id="candidate-panel-close">✕</button>
    </div>
    <div class="slideover-body">
      <div class="slideover-section-title">Properties</div>
      <div class="lp-row">
        <label class="lp-label">Status</label>
        <select class="lp-input" id="cp-status">
          ${CANDIDATE_STATUSES.map(s => `<option value="${s.id}" ${c.status===s.id?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="lp-row"><label class="lp-label">Position</label><div class="lp-static">${pos ? escHtml(pos.title) : '—'}</div></div>
      <div class="lp-row"><label class="lp-label">Location</label><div class="lp-static">${escHtml(c.location || '—')}</div></div>
      <div class="lp-row"><label class="lp-label">Email</label><div class="lp-static">${escHtml(c.email || '—')}</div></div>
      <div class="lp-row"><label class="lp-label">Current Salary</label><div class="lp-static">${escHtml(c.currentSalary||c.current_salary||'—')}</div></div>
      <div class="lp-row"><label class="lp-label">Desired Salary</label><div class="lp-static" style="color:var(--green)">${escHtml(c.desiredSalary||c.desired_salary||'—')}</div></div>
      <div class="lp-row">
        <label class="lp-label">Email sent</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2);cursor:pointer">
          <input type="checkbox" id="cp-email-sent" ${emailSent?'checked':''} style="accent-color:var(--accent)" /> Outreach email sent to candidate
        </label>
      </div>
      <div class="lp-row">
        <label class="lp-label">Notes</label>
        <textarea class="lp-input" rows="4" id="cp-notes">${escHtml(c.notes || '')}</textarea>
      </div>
      <div class="slideover-section-title">Summary</div>
      <div style="font-size:12px;color:var(--text-2);line-height:1.7">${escHtml(c.summary || '')}</div>
      ${(c.tags||[]).length ? `<div class="rec-cand-tags" style="margin-top:10px">${(c.tags||[]).map(t=>`<span class="rec-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="slideover-section-title">Related</div>
      ${driveUrl?`<a href="${driveUrl}" target="_blank" class="rec-cv-link">📄 View CV →</a>`:''}
      <span class="cand-status-pill" style="margin-left:8px;background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${st.label}</span>
    </div>
  </div>`;
}

function attachCandidatePanelEvents() {
  if (!document.getElementById('candidate-panel')) return;
  const allC = allCandidates();
  const c = allC.find(x => x.id === state.candidatePanel);
  if (!c) return;
  const close = () => { state.candidatePanel = null; app.render(); };
  document.getElementById('candidate-panel-close')?.addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', esc); if (state.candidatePanel) close(); }
  });
  document.getElementById('cp-status')?.addEventListener('change', async (e) => {
    if (c.isDb) { c.status = e.target.value; await updateDbCandidate(c.id, { status: e.target.value }); showToast(`Status updated`); }
    else { c.status = e.target.value; persistCandidate(c); showToast(`${c.name} → ${e.target.value}`); }
    app.render();
  });
  document.getElementById('cp-email-sent')?.addEventListener('change', async (e) => {
    if (c.isDb) { c.email_sent = e.target.checked; await updateDbCandidate(c.id, { email_sent: e.target.checked }); }
    else { c.emailSent = e.target.checked; persistCandidate(c); }
    showToast(e.target.checked ? `✉ Email marked sent` : `Email unmarked`);
  });
  document.getElementById('cp-notes')?.addEventListener('input', async (e) => {
    if (c.isDb) { c.notes = e.target.value; await updateDbCandidate(c.id, { notes: e.target.value }); }
    else { c.notes = e.target.value; persistCandidate(c); }
  });
}

export { renderRecruiting, renderGeneralCVs, renderJobApplications, renderAIAssessments, renderFilesView, renderCandidatePanel, attachCandidatePanelEvents };
