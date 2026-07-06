// Dashboard page: Overview (home) + Team directory.
// NOTE: Team was relocated here (Dashboard > Team tab) from its own top-level
// sidebar item during the nav restructure.
import { state, escHtml, fmt$, showToast, app } from '../app-core.js';
import { currentUser, currentProfile } from '../auth.js';
import { supabase } from '../supabase.js';
import { fetchTeamMembers as fetchTeam, updateProfile } from '../team.js';

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
        <button id="btn-lock-team" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);color:var(--green);cursor:pointer;font-size:11px;display:flex;align-items:center;gap:6px">🔓 Unlocked</button>
      ` : `
        <button id="btn-unlock-team" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;font-size:11px;display:flex;align-items:center;gap:6px">🔒 CEO Lock</button>
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
          <div style="width:48px;height:48px;border-radius:12px;background:var(--gradient-accent);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;position:relative">
            ${(m.full_name||m.email||'?')[0].toUpperCase()}
            <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${statusColor};border:2px solid var(--bg-card-flat)"></div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:600;color:var(--text)">${m.full_name||'Unnamed'}</div>
            <div style="font-size:12px;color:var(--accent-2);">${m.designation||m.role||'Member'}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">${m.email}</div>
        ${m.department ? `<div style="font-size:10px;color:var(--text-3);margin-bottom:6px">🏢 ${m.department}</div>` : ''}
        ${m.bio ? `<div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-bottom:8px">${m.bio}</div>` : ''}
        ${m.skills?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${m.skills.map(s => `<span class="rec-tag">${s}</span>`).join('')}</div>` : ''}
        ${m.phone ? `<div style="font-size:11px;color:var(--text-3)">📞 ${m.phone}</div>` : ''}
      </div>`;
    }).join('')}
    ${state.team.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px;grid-column:1/-1">No team members yet. Sign up users to see them here.</div>' : ''}
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
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Email Address *</label>
          <input type="email" name="email" required placeholder="team@itimpact.com" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          <div style="font-size:10px;color:var(--text-3);margin-top:5px">They'll receive an invite email to set their password.</div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Full Name</label>
            <input type="text" name="full_name" value="${escHtml(m.full_name||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Designation</label>
            <input type="text" name="designation" value="${escHtml(m.designation||'')}" placeholder="e.g. CTO, Designer, Sales Lead" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Department</label>
            <input type="text" name="department" value="${escHtml(m.department||'')}" placeholder="e.g. Engineering, Sales" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Phone</label>
            <input type="text" name="phone" value="${escHtml(m.phone||'')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Designation / Role</label>
            <input type="text" name="designation_role" value="${escHtml(m.designation || m.role || '')}" placeholder="e.g. CEO, CTO, Lead Designer, Sales Head" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Status</label>
            <select name="status" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;">
              <option value="active" ${m.status==='active'||!m.status?'selected':''}>Active</option>
              <option value="away" ${m.status==='away'?'selected':''}>Away</option>
              <option value="offline" ${m.status==='offline'?'selected':''}>Offline</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Bio</label>
          <textarea name="bio" rows="2" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;resize:vertical;">${escHtml(m.bio||'')}</textarea>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Skills (comma separated)</label>
          <input type="text" name="skills" value="${(m.skills||[]).join(', ')}" placeholder="e.g. React, Sales, AI, Design" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-accent);color:#fff;cursor:pointer;font-weight:700;font-size:13px">${isEdit ? 'Save Changes' : 'Add Member'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderHome() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentProfile?.full_name?.split(' ')[0] || 'there';
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  // Lead stats
  const totalLeads = state.leads.length;
  const newLeads = state.leads.filter(l => l.status === 'new').length;
  const qualifiedLeads = state.leads.filter(l => l.status === 'qualified').length;
  const proposalLeads = state.leads.filter(l => l.status === 'proposal').length;
  const wonLeads = state.leads.filter(l => l.status === 'won').length;
  const totalValue = state.leads.reduce((s,l) => s + (l.value || 0), 0);
  const wonValue = state.leads.filter(l=>l.status==='won').reduce((s,l)=>s+(l.value||0),0);

  // Project stats
  const activeProjects = state.projects.filter(p => p.status !== 'completed').length;
  const completedProjects = state.projects.filter(p => p.status === 'completed').length;

  // Hiring stats
  const newJobApps = state.jobApplications.filter(j => j.status === 'new').length;
  const newCVs = state.generalCVs.filter(c => c.status === 'new').length;
  const totalCandidates = state.jobApplications.length + state.generalCVs.length;

  // Social stats
  const pendingPosts = state.socialPosts.filter(p => ['awaiting_review','pending_approval'].includes(p.status)).length;
  const approvedPosts = state.socialPosts.filter(p => p.status === 'approved').length;
  const publishedPosts = state.socialPosts.filter(p => p.status === 'published').length;

  // Task stats
  const myTasks = state.tasks.filter(t => t.assigned_to === currentUser?.id);
  const myOpenTasks = myTasks.filter(t => t.status !== 'completed').length;
  const overdueTasks = state.tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length;
  const todoTasks = state.tasks.filter(t => t.status === 'todo').length;

  // Recent activity — last 5 leads
  const recentLeads = [...state.leads].sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
  // Recent job apps
  const recentApps = [...state.jobApplications].sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,3);
  const recentCVs = [...state.generalCVs].sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,3);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff/60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  };

  const pipeStages = [
    {label:'New',       id:'new',         color:'#94a3b8'},
    {label:'Qualified', id:'qualified',   color:'var(--accent)'},
    {label:'Proposal',  id:'proposal',    color:'#f59e0b'},
    {label:'Negotiation',id:'negotiation',color:'#f97316'},
    {label:'Won',       id:'won',         color:'#10b981'},
  ];
  const recentActivity = [
    ...recentLeads.map(l=>({key:'lead',  label:l.company||l.name||'—', sub: l.contact_name||l.title||'New lead', val:l.value?fmt$(l.value):'', time:l.created_at, initials:(l.company||l.name||'?')[0].toUpperCase(), bg:'var(--accent)'})),
    ...recentApps.map(a=> ({key:'app',   label:a.name||'—',            sub:`Applied · ${a.position_title||'role'}`,                                val:'',           time:a.created_at, initials:(a.name||'?')[0].toUpperCase(), bg:'#8b5cf6'})),
    ...recentCVs.map(c=>  ({key:'cv',    label:c.name||'—',            sub:`CV · ${c.current_title||'General'}`,                                    val:'',           time:c.created_at, initials:(c.name||'?')[0].toUpperCase(), bg:'#06b6d4'})),
  ].sort((a,b)=>new Date(b.time||0)-new Date(a.time||0)).slice(0,6);

  return `
  <div style="max-width:1140px">

    <!-- Greeting bar -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-weight:800;font-size:26px;color:var(--text);letter-spacing:-0.5px">${greeting}, ${name}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:3px">${dateStr}</div>
      </div>
      ${pendingPosts > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.07);cursor:pointer" data-nav="social-planner">
        <span style="font-size:13px;color:#f59e0b;font-weight:700">${pendingPosts} post${pendingPosts>1?'s':''} awaiting approval</span>
        <span style="font-size:11px;color:#f59e0b;">Review →</span>
      </div>` : ''}
      ${state.contactSubmissions.filter(c=>c.status==='new').length > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid rgba(249,115,22,0.35);background:rgba(249,115,22,0.07);cursor:pointer" data-nav="contact-subs">
        <span style="font-size:13px;color:#f97316;font-weight:700">${state.contactSubmissions.filter(c=>c.status==='new').length} new enquir${state.contactSubmissions.filter(c=>c.status==='new').length>1?'ies':'y'}</span>
        <span style="font-size:11px;color:#f97316;">View →</span>
      </div>` : ''}
    </div>

    <!-- KPI grid: 4 across -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px">
      <div class="home-kpi-card" data-nav="leads">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Total leads</div>
        <div style="font-weight:800;font-size:32px;color:var(--accent);letter-spacing:-1px;line-height:1">${totalLeads}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${newLeads} new · ${qualifiedLeads} qualified</div>
      </div>
      <div class="home-kpi-card" data-nav="leads">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Pipeline value</div>
        <div style="font-weight:800;font-size:32px;color:#10b981;letter-spacing:-1px;line-height:1">${fmt$(totalValue)}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${fmt$(wonValue)} won</div>
      </div>
      <div class="home-kpi-card" data-nav="projects">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Active projects</div>
        <div style="font-weight:800;font-size:32px;color:#f59e0b;letter-spacing:-1px;line-height:1">${activeProjects}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${completedProjects} completed</div>
      </div>
      <div class="home-kpi-card" data-nav="job-apps">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">New applications</div>
        <div style="font-weight:800;font-size:32px;color:#8b5cf6;letter-spacing:-1px;line-height:1">${newJobApps+newCVs}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${totalCandidates} total candidates</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="home-kpi-card" data-nav="social-planner">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Published posts</div>
        <div style="font-weight:800;font-size:32px;color:#06b6d4;letter-spacing:-1px;line-height:1">${publishedPosts}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${pendingPosts} pending · ${approvedPosts} approved</div>
      </div>
      <div class="home-kpi-card" data-nav="team">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Team members</div>
        <div style="font-weight:800;font-size:32px;color:#ec4899;letter-spacing:-1px;line-height:1">${state.team.length}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">active users</div>
      </div>
      <div class="home-kpi-card" data-nav="tasks">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">My open tasks</div>
        <div style="font-weight:800;font-size:32px;color:${overdueTasks>0?'#ef4444':'#22c55e'};letter-spacing:-1px;line-height:1">${myOpenTasks}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${overdueTasks>0?`<span style="color:#ef4444">${overdueTasks} overdue</span>`:todoTasks+' total to do'}</div>
      </div>
      <div class="home-kpi-card" data-nav="contact-subs">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">New enquiries</div>
        <div style="font-weight:800;font-size:32px;color:#f97316;letter-spacing:-1px;line-height:1">${state.contactSubmissions.filter(c=>c.status==='new').length}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${state.contactSubmissions.length} total</div>
      </div>
    </div>

    <!-- Bottom: pipeline + activity + sidebar -->
    <div style="display:grid;grid-template-columns:1fr 1fr 280px;gap:16px">

      <!-- Pipeline bars -->
      <div class="home-card">
        <div class="home-card-header">
          <div class="home-card-title">Lead pipeline</div>
          <button class="home-card-link" data-nav="leads">View all →</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${pipeStages.map(s => {
            const count = state.leads.filter(l=>l.status===s.id).length;
            const pct = totalLeads ? Math.round(count/totalLeads*100) : 0;
            return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                <span style="font-size:12px;font-weight:600;color:var(--text-2)">${s.label}</span>
                <span style="font-size:11px;color:var(--text-3)">${count}</span>
              </div>
              <div style="height:6px;border-radius:3px;background:var(--bg-1);overflow:hidden">
                <div style="height:100%;border-radius:3px;background:${s.color};width:${pct||0}%;transition:width 0.4s"></div>
              </div>
            </div>`;
          }).join('')}
          ${totalLeads === 0 ? '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:11px">No leads yet</div>' : ''}
        </div>
      </div>

      <!-- Recent activity -->
      <div class="home-card">
        <div class="home-card-header">
          <div class="home-card-title">Recent activity</div>
        </div>
        <div style="display:flex;flex-direction:column">
          ${recentActivity.length === 0
            ? '<div style="text-align:center;padding:24px;color:var(--text-3);font-size:11px">No activity yet</div>'
            : recentActivity.map(a => `
            <div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--border-subtle)">
              <div style="width:32px;height:32px;border-radius:8px;background:${a.bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${a.initials}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.label}</div>
                <div style="font-size:11px;color:var(--text-3);">${a.sub}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                ${a.val ? `<div style="font-size:12px;font-weight:700;color:var(--text)">${a.val}</div>` : ''}
                <div style="font-size:10px;color:var(--text-3);">${timeAgo(a.time)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Right column: quick actions + status -->
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="home-card">
          <div class="home-card-header">
            <div class="home-card-title">My tasks</div>
            <button class="home-card-link" data-nav="tasks">View all →</button>
          </div>
          ${myTasks.filter(t => t.status !== 'completed').length === 0 ? '<div style="font-size:11px;color:var(--text-3);padding:8px 0">No open tasks — great work!</div>' : ''}
          <div style="display:flex;flex-direction:column;gap:5px">
            ${myTasks.filter(t => t.status !== 'completed').slice(0,5).map(t => {
              const overdue = t.due_date && new Date(t.due_date) < now;
              const sc = t.status==='in_progress'?'#6366f1':'#f59e0b';
              return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--bg-2);border-left:3px solid ${overdue?'#ef4444':sc}">
                <span style="flex:1;font-size:12px;color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</span>
                <span style="font-size:9px;color:${overdue?'#ef4444':'var(--text-3)'};flex-shrink:0">${t.due_date?new Date(t.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="home-card">
          <div class="home-card-header"><div class="home-card-title">Quick actions</div></div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[
              {icon:'⚡',label:'Add new lead',nav:'leads'},
              {icon:'✓', label:'Assign a task',nav:'tasks'},
              {icon:'📄',label:'Upload a CV',nav:'general-cvs'},
              {icon:'📋',label:'Social planner',nav:'social-planner'},
              {icon:'📝',label:'Write article (AI)',nav:'articles'},
              {icon:'🤖',label:'Ask Jarvis',nav:'agents'},
            ].map(a=>`
            <div data-nav="${a.nav}" style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-1);cursor:pointer;transition:border-color 0.15s">
              <span style="font-size:14px">${a.icon}</span>
              <span style="font-size:12px;font-weight:600;color:var(--text)">${a.label}</span>
              <span style="margin-left:auto;font-size:12px;color:var(--text-3)">→</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="home-card">
          <div class="home-card-header"><div class="home-card-title">System status</div></div>
          <div style="display:flex;flex-direction:column;gap:9px">
            ${[
              {label:'Database',    ok:true},
              {label:'Google Analytics', ok:state.googleConnected},
              {label:'LinkedIn',    ok:state.linkedinConnected},
              {label:'Web tracker', ok:true},
              {label:'AI agents',   ok:!!(localStorage.getItem('openai_key')||localStorage.getItem('anthropic_key'))},
            ].map(r=>`
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;color:var(--text-2)">${r.label}</span>
              <span style="font-size:10px;padding:2px 9px;border-radius:20px;background:${r.ok?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'};color:${r.ok?'#10b981':'var(--red)'}">
                ${r.ok?'● on':'○ off'}
              </span>
            </div>`).join('')}
          </div>
        </div>
      </div>

    </div>
  </div>`;
}

// ── Team Events ─────────────────────────────────────────────────────
function attachTeamEvents() {
  document.getElementById('btn-unlock-team')?.addEventListener('click', () => {
    const code = prompt('🔒 Enter CEO code to unlock team management:');
    if (code === CEO_CODE) {
      ceoUnlocked = true;
      showToast('🔓 Team management unlocked', 'success');
      app.render();
    } else if (code !== null) {
      showToast('❌ Incorrect code', 'error');
    }
  });
  document.getElementById('btn-lock-team')?.addEventListener('click', () => {
    ceoUnlocked = false;
    showToast('🔒 Team management locked', 'info');
    app.render();
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
        app.render();
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
        const email = fd.get('email')?.trim();
        if (!email) { showToast('Email is required to add a member', 'error'); return; }
        const submitBtn = document.querySelector('#member-form button[type="submit"]');
        if (submitBtn) { submitBtn.textContent = 'Adding…'; submitBtn.disabled = true; }
        const res = await fetch('/api/invite-team-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, ...updates }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to add member');
        showToast(result.existing ? 'Profile updated for existing user ✓' : 'Member added — invite email sent ✓', 'success');
      }
      state.team = await fetchTeam();
      closeModal();
      app.render();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}


export { renderHome, renderTeam, attachTeamEvents };
