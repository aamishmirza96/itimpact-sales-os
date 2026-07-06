// Shared website-submission card + status configs + event handlers.
// Used by both the Recruiting page (CVs, job applications, AI assessments)
// and the Inbox page (contact submissions).
import { state, escHtml, showToast, app } from '../app-core.js';
import {
  updateContactStatus, fetchContactSubmissions,
  fetchGeneralCVs, updateGeneralCVStatus,
  fetchJobApplications, updateJobApplicationStatus,
  fetchAIAssessments, updateAIAssessmentStatus,
  deleteGeneralCV, uploadAndAddCV,
} from '../submissions.js';

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
        <span style="font-size:10px;color:var(--text-3)">${new Date(s.created_at).toLocaleDateString()} ${new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
      </div>
    </div>
    ${isExpanded ? `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)" onclick="event.stopPropagation()">
      ${opts.renderDetail ? opts.renderDetail(s) : ''}
      <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--text-3);text-transform:uppercase">Status:</span>
        <select class="cand-status-select" data-submission-status="${idPrefix}${s.id}" data-submission-table="${opts.table}">
          ${statusOptions.map(o=>`<option value="${o.id}" ${s[statusField]===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        <button data-assign-task="${s.id}" data-task-entity-type="${opts.table}" data-task-entity-label="${escHtml(s.full_name)}" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-size:10px">+ Assign Follow-up</button>
      </div>
      ${(state.tasks.filter(t => t.entity_type === opts.table && t.entity_id === String(s.id))).length ? `
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
          <span style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em">Tasks</span>
          ${state.tasks.filter(t => t.entity_type === opts.table && t.entity_id === String(s.id)).map(t => {
            const sc = t.status==='completed'?'#10b981':t.status==='in_progress'?'#6366f1':'#f59e0b';
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-2);border-radius:6px;font-size:12px">
              <span style="width:8px;height:8px;border-radius:50%;background:${sc};flex-shrink:0"></span>
              <span style="flex:1;color:var(--text)">${escHtml(t.title)}</span>
              <span style="font-size:10px;color:var(--text-3)">${t.assignee?.full_name||'?'}</span>
              <span style="font-size:10px;color:${sc}">${t.status.replace('_',' ')}</span>
              <button data-edit-task="${t.id}" onclick="event.stopPropagation()" style="padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text-3);cursor:pointer;font-size:10px">Edit</button>
            </div>`;
          }).join('')}
        </div>` : ''}
    </div>` : ''}
  </div>`;
}

const CONTACT_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'contacted',label:'Contacted',color:'#6366f1'},{id:'closed',label:'Closed',color:'#10b981'}];
const CV_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'reviewing',label:'Reviewing',color:'#6366f1'},{id:'shortlisted',label:'Shortlisted',color:'#10b981'},{id:'rejected',label:'Rejected',color:'#ef4444'}];
const JOBAPP_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'reviewing',label:'Reviewing',color:'#6366f1'},{id:'shortlisted',label:'Shortlisted',color:'#8b5cf6'},{id:'interviewing',label:'Interviewing',color:'#06b6d4'},{id:'hired',label:'Hired',color:'#10b981'},{id:'rejected',label:'Rejected',color:'#ef4444'}];
const AI_STATUSES = [{id:'new',label:'New',color:'#f59e0b'},{id:'contacted',label:'Contacted',color:'#6366f1'},{id:'qualified',label:'Qualified',color:'#10b981'},{id:'closed',label:'Closed',color:'#94a3b8'}];

// ── Website Submissions Events ──────────────────────────────────────
function attachSubmissionEvents() {
  document.querySelectorAll('[data-toggle-submission]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggleSubmission;
      state.expandedSubmission = state.expandedSubmission === id ? null : id;
      app.render();
    });
  });
  document.querySelectorAll('[data-jobapp-filter]').forEach(el => {
    el.addEventListener('click', () => { state.jobAppFilter = el.dataset.jobappFilter; app.render(); });
  });

  // Add CV modal
  document.querySelectorAll('[data-open-add-cv]').forEach(btn => {
    btn.addEventListener('click', () => { state.showAddCVModal = true; app.render(); });
  });
  document.querySelectorAll('[data-close-add-cv]').forEach(btn => {
    btn.addEventListener('click', () => { state.showAddCVModal = false; app.render(); });
  });
  document.querySelectorAll('[data-submit-add-cv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = document.getElementById('cv-name')?.value.trim();
      const email = document.getElementById('cv-email')?.value.trim();
      if (!name || !email) { showToast('Name and email are required', 'error'); return; }
      const file = document.getElementById('cv-file')?.files[0] || null;
      btn.textContent = 'Uploading…'; btn.disabled = true;
      try {
        await uploadAndAddCV({
          name, email,
          phone: document.getElementById('cv-phone')?.value.trim(),
          currentTitle: document.getElementById('cv-title')?.value.trim(),
          currentCompany: document.getElementById('cv-company')?.value.trim(),
          location: document.getElementById('cv-location')?.value.trim(),
          file,
        });
        state.generalCVs = await fetchGeneralCVs();
        state.showAddCVModal = false;
        showToast('CV uploaded successfully', 'success');
        app.render();
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
        btn.textContent = 'Upload CV'; btn.disabled = false;
      }
    });
  });

  // Delete CV
  document.querySelectorAll('[data-delete-cv]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this CV permanently? This cannot be undone.')) return;
      try {
        await deleteGeneralCV(btn.dataset.deleteCv);
        state.generalCVs = await fetchGeneralCVs();
        showToast('CV deleted', 'success');
        app.render();
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
      }
    });
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
      app.render();
    });
  });
}


export { submissionCard, CONTACT_STATUSES, CV_STATUSES, JOBAPP_STATUSES, AI_STATUSES, attachSubmissionEvents };
