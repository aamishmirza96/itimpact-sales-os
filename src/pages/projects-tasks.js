// Projects & Tasks page: Basecamp-style project spaces and the task system.
import { state, escHtml, showToast, app } from '../app-core.js';
import { currentUser } from '../auth.js';
import {
  fetchProjects, createProject, fetchMessages, createMessage,
  fetchTodoLists, createTodoList, createTodo, toggleTodo, deleteTodo,
  fetchEvents, createEvent, fetchChatMessages, sendChatMessage,
  subscribeToChatMessages, fetchCheckins, createCheckin, respondToCheckin,
} from '../projects.js';
import { fetchTasks, createTask, updateTask, deleteTask } from '../tasks.js';
import { fetchTeamMembers as fetchTeam } from '../team.js';

// ── Task Modal ───────────────────────────────────────────────────────
function renderTaskModal() {
  const ctx = state.taskEntityContext || {};
  const t = state.taskEditData || {};
  const isEdit = !!t.id;
  const today = new Date().toISOString().split('T')[0];
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Task' : 'Assign Task'}</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="task-form" style="padding:20px 28px 24px">
        ${ctx.entity_label ? `<div style="padding:8px 12px;background:var(--bg-2);border-radius:8px;font-size:12px;color:var(--text-3);margin-bottom:14px;">Linked to: <strong style="color:var(--text)">${escHtml(ctx.entity_label)}</strong></div>` : ''}
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Task Title *</label>
          <input type="text" name="title" required value="${escHtml(t.title||'')}" placeholder="e.g. Send proposal, Follow up call, Review CV" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Assign To *</label>
            <select name="assigned_to" required style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;">
              <option value="">Select person...</option>
              ${state.team.map(m => `<option value="${m.id}" ${t.assigned_to===m.id?'selected':''}>${m.full_name||m.email}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Due Date</label>
            <input type="date" name="due_date" value="${t.due_date||today}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Description (optional)</label>
          <textarea name="description" rows="3" placeholder="Any additional context..." style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;resize:vertical;line-height:1.6">${escHtml(t.description||'')}</textarea>
        </div>
        ${isEdit ? `
        <div style="margin-bottom:16px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Status</label>
          <select name="status" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;">
            <option value="todo" ${t.status==='todo'?'selected':''}>To Do</option>
            <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
            <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
          </select>
        </div>` : ''}
        <div style="display:flex;gap:10px;justify-content:flex-end">
          ${isEdit ? `<button type="button" id="btn-delete-task" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-size:12px">Delete Task</button>` : ''}
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-weight:700;font-size:13px">${isEdit ? 'Save' : 'Assign Task'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Tasks View ───────────────────────────────────────────────────────
function renderTasksView() {
  const statusColors = { todo: '#f59e0b', in_progress: '#6366f1', completed: '#10b981' };
  const statusLabels = { todo: 'To Do', in_progress: 'In Progress', completed: 'Completed' };
  const filtered = state.taskFilter === 'all' ? state.tasks : state.tasks.filter(t => t.status === state.taskFilter);
  const myTasks = state.tasks.filter(t => t.assigned_to === currentUser?.id);
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Tasks</div>
      <div class="page-sub">${state.tasks.length} total · ${myTasks.length} assigned to me</div>
    </div>
    <button class="find-leads-btn" id="btn-new-task">+ New Task</button>
  </div>
  <div class="metrics-row" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    ${['all','todo','in_progress','completed'].map(s => {
      const count = s === 'all' ? state.tasks.length : state.tasks.filter(t => t.status === s).length;
      const color = s === 'all' ? 'var(--accent)' : statusColors[s];
      const label = s === 'all' ? 'All Tasks' : statusLabels[s];
      return `<div class="metric-card" style="cursor:pointer;${state.taskFilter===s?'border-color:'+color:''}" data-task-filter="${s}">
        <div class="metric-label">${label}</div>
        <div class="metric-value" style="color:${color}">${count}</div>
      </div>`;
    }).join('')}
  </div>
  <div class="rec-cands-list">
    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No tasks in this category.</div>' : ''}
    ${filtered.map(t => {
      const sc = statusColors[t.status] || '#5a5a72';
      const overdue = t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date();
      return `
      <div class="rec-cand-card" style="cursor:pointer" data-edit-task="${t.id}">
        <div class="rec-cand-avatar" style="background:linear-gradient(135deg,${sc},${sc}aa)">${(t.assignee?.full_name||'?')[0].toUpperCase()}</div>
        <div class="rec-cand-body">
          <div class="rec-cand-top">
            <div>
              <div class="rec-cand-name">${escHtml(t.title)}</div>
              <div class="rec-cand-role">→ ${t.assignee?.full_name||'Unassigned'}${t.entity_label?' · '+t.entity_label:''}</div>
              ${t.description ? `<div class="rec-cand-summary">${escHtml(t.description)}</div>` : ''}
              <div style="font-size:10px;color:${overdue?'var(--red)':'var(--text-3)'};margin-top:2px">
                ${t.due_date ? (overdue?'⚠ Overdue: ':'Due: ')+new Date(t.due_date).toLocaleDateString() : 'No due date'}
                ${t.completed_at ? ' · Completed '+new Date(t.completed_at).toLocaleDateString() : ''}
              </div>
            </div>
            <div class="rec-cand-actions">
              <span class="cand-status-pill" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${statusLabels[t.status]||t.status}</span>
              <select class="cand-status-select" data-task-status="${t.id}" onclick="event.stopPropagation()">
                <option value="todo" ${t.status==='todo'?'selected':''}>To Do</option>
                <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
                <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
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

  ${state.projectsLoading ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">Loading projects...</div>' : ''}

  <div class="rec-positions-grid">
    ${state.projects.length === 0 && !state.projectsLoading ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No projects yet. Click "+ New Project" to create one.</div>' : ''}
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
      <button id="btn-back-projects" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;font-size:11px">← Back</button>
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
      <input type="text" name="title" placeholder="Message title..." required style="width:100%;padding:10px 0;background:transparent;border:none;color:var(--text);font-size:15px;font-weight:500;outline:none;border-bottom:1px solid var(--border);margin-bottom:12px" />
      <textarea name="body" placeholder="Write your message..." rows="3" style="width:100%;padding:8px 0;background:transparent;border:none;color:var(--text-2);font-size:13px;outline:none;resize:vertical;min-height:60px"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button type="submit" style="padding:8px 18px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:12px">Post Message</button>
      </div>
    </form>
  </div>
  ${state.projectMessages.map(m => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div style="padding:16px 20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:30px;height:30px;border-radius:6px;background:var(--gradient-navy);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;">${(m.author?.full_name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:12px;font-weight:500;color:var(--text)">${m.author?.full_name||'Unknown'}</div>
            <div style="font-size:10px;color:var(--text-3);">${new Date(m.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:8px">${m.title}</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7;white-space:pre-wrap">${m.body||''}</div>
      </div>
    </div>`).join('')}
  ${state.projectMessages.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No messages yet. Post the first one above.</div>' : ''}`;
}

function renderTodos() {
  return `
  <div style="margin-bottom:16px">
    <form id="new-todolist-form" style="display:flex;gap:8px">
      <input type="text" name="listName" placeholder="New to-do list name..." required style="flex:1;padding:10px 14px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none" />
      <button type="submit" style="padding:10px 18px;border-radius:8px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:12px;white-space:nowrap">+ Add List</button>
    </form>
  </div>
  ${state.projectTodoLists.map(list => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div class="outreach-prospect-header">
        <div class="outreach-prospect-name">${list.name}</div>
        <span style="font-size:11px;color:var(--text-3)">${(list.todos||[]).filter(t=>t.completed).length}/${(list.todos||[]).length} done</span>
      </div>
      <div style="padding:12px 20px">
        ${(list.todos||[]).map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)" data-todo-id="${t.id}">
            <input type="checkbox" ${t.completed?'checked':''} data-toggle-todo="${t.id}" style="accent-color:var(--accent);cursor:pointer" />
            <span style="flex:1;font-size:13px;color:${t.completed?'var(--text-3)':'var(--text)'};${t.completed?'text-decoration:line-through':''}">${t.title}</span>
            ${t.assignee?.full_name ? `<span style="font-size:10px;color:var(--accent-2);background:var(--accent-glow);padding:2px 8px;border-radius:4px">${t.assignee.full_name}</span>` : ''}
            ${t.due_date ? `<span style="font-size:10px;color:var(--amber)">${t.due_date}</span>` : ''}
            <button data-delete-todo="${t.id}" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:12px;padding:2px 4px" title="Delete">✕</button>
          </div>`).join('')}
        <form class="add-todo-form" data-list-id="${list.id}" style="display:flex;gap:8px;margin-top:10px">
          <input type="text" name="title" placeholder="Add a to-do..." required style="flex:1;padding:8px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
          <button type="submit" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--accent-2);cursor:pointer;font-size:11px">Add</button>
        </form>
      </div>
    </div>`).join('')}
  ${state.projectTodoLists.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No to-do lists yet. Create one above.</div>' : ''}`;
}

function renderSchedule() {
  return `
  <form id="new-event-form" style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:20px">
    <div style="display:grid;grid-template-columns:1fr 120px 100px;gap:10px;align-items:end">
      <div>
        <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Event Title</label>
        <input type="text" name="title" required placeholder="Meeting, deadline, milestone..." style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Date</label>
        <input type="date" name="date" required style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
      </div>
      <button type="submit" style="padding:9px 14px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:12px">Add</button>
    </div>
  </form>
  ${state.projectEvents.map(e => {
    const d = new Date(e.event_date);
    const isPast = d < new Date();
    return `
    <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border-subtle)">
      <div style="min-width:48px;text-align:center">
        <div style="font-weight:800;font-size:20px;color:${isPast?'var(--text-3)':'var(--accent-2)'};line-height:1">${d.getDate()}</div>
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">${d.toLocaleString('en',{month:'short'})}</div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:500;color:${isPast?'var(--text-3)':'var(--text)'}">${e.title}</div>
        ${e.description ? `<div style="font-size:12px;color:var(--text-2);margin-top:2px">${e.description}</div>` : ''}
      </div>
    </div>`;
  }).join('')}
  ${state.projectEvents.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No events scheduled. Add one above.</div>' : ''}`;
}

function renderChat() {
  return `
  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;height:calc(100vh - 280px)">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);font-weight:700;font-size:14px;color:var(--text)">🔥 Campfire</div>
    <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px">
      ${state.projectChat.map(m => {
        const isMe = m.author_id === currentUser?.id;
        return `
        <div style="display:flex;gap:10px;align-items:flex-start;${isMe?'flex-direction:row-reverse':''}">
          <div style="width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,${isMe?'var(--green)':'var(--accent)'},${isMe?'#059669':'#4f46e5'});display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${(m.author?.full_name||'?')[0].toUpperCase()}</div>
          <div style="max-width:70%;${isMe?'text-align:right':''}">
            <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">${m.author?.full_name||'Unknown'} · ${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            <div style="padding:10px 14px;border-radius:10px;background:${isMe?'var(--accent-glow)':'var(--bg-3)'};font-size:13px;color:var(--text-2);line-height:1.6;display:inline-block;text-align:left">${m.body}</div>
          </div>
        </div>`;
      }).join('')}
      ${state.projectChat.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No messages yet. Start the conversation!</div>' : ''}
    </div>
    <form id="chat-form" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">
      <input type="text" name="message" placeholder="Type a message..." required autocomplete="off" style="flex:1;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none" />
      <button type="submit" style="padding:10px 18px;border-radius:8px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:12px">Send</button>
    </form>
  </div>`;
}

function renderCheckinView() {
  return `
  <form id="new-checkin-form" style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:20px">
    <div style="display:grid;grid-template-columns:1fr 120px 80px;gap:10px;align-items:end">
      <div>
        <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Check-in Question</label>
        <input type="text" name="question" required placeholder="What did you work on today?" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;display:block;margin-bottom:6px">Frequency</label>
        <select name="frequency" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <button type="submit" style="padding:9px 14px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:12px">Add</button>
    </div>
  </form>
  ${state.projectCheckins.map(c => `
    <div class="outreach-prospect-block" style="margin-bottom:14px">
      <div class="outreach-prospect-header">
        <div>
          <div class="outreach-prospect-name">❓ ${c.question}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${c.frequency} · ${(c.responses||[]).length} responses</div>
        </div>
      </div>
      <div style="padding:12px 20px">
        ${(c.responses||[]).slice(0,5).map(r => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="font-size:12px;font-weight:500;color:var(--text)">${r.author?.full_name||'Unknown'}</span>
              <span style="font-size:10px;color:var(--text-3);">${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <div style="font-size:12px;color:var(--text-2);line-height:1.6">${r.body}</div>
          </div>`).join('')}
        <form class="checkin-respond-form" data-checkin-id="${c.id}" style="display:flex;gap:8px;margin-top:10px">
          <input type="text" name="response" placeholder="Your response..." required style="flex:1;padding:8px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
          <button type="submit" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--accent-2);cursor:pointer;font-size:11px">Reply</button>
        </form>
      </div>
    </div>`).join('')}
  ${state.projectCheckins.length===0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">No check-ins yet. Create one above.</div>' : ''}`;
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
    app.render();
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
    app.render();
  });
  document.querySelectorAll('[data-ptab]').forEach(el => {
    el.addEventListener('click', async () => {
      state.projectTab = el.dataset.ptab;
      await loadProjectTabData();
      app.render();
    });
  });
  // Message board
  document.getElementById('new-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createMessage(state.activeProject.id, fd.get('title'), fd.get('body'));
    state.projectMessages = await fetchMessages(state.activeProject.id);
    showToast('Message posted', 'success');
    app.render();
  });
  // Todo lists
  document.getElementById('new-todolist-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createTodoList(state.activeProject.id, fd.get('listName'));
    state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
    showToast('To-do list created', 'success');
    app.render();
  });
  document.querySelectorAll('.add-todo-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await createTodo(form.dataset.listId, fd.get('title'));
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      app.render();
    });
  });
  document.querySelectorAll('[data-toggle-todo]').forEach(cb => {
    cb.addEventListener('change', async () => {
      await toggleTodo(cb.dataset.toggleTodo, cb.checked);
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      app.render();
    });
  });
  document.querySelectorAll('[data-delete-todo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteTodo(btn.dataset.deleteTodo);
      state.projectTodoLists = await fetchTodoLists(state.activeProject.id);
      app.render();
    });
  });
  // Schedule
  document.getElementById('new-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createEvent(state.activeProject.id, fd.get('title'), '', fd.get('date'));
    state.projectEvents = await fetchEvents(state.activeProject.id);
    showToast('Event added', 'success');
    app.render();
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
    app.render();
    scrollChatToBottom();
  });
  // Check-ins
  document.getElementById('new-checkin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createCheckin(state.activeProject.id, fd.get('question'), fd.get('frequency'));
    state.projectCheckins = await fetchCheckins(state.activeProject.id);
    showToast('Check-in created', 'success');
    app.render();
  });
  document.querySelectorAll('.checkin-respond-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await respondToCheckin(form.dataset.checkinId, fd.get('response'));
      state.projectCheckins = await fetchCheckins(state.activeProject.id);
      app.render();
    });
  });
  scrollChatToBottom();
}

async function openProject(p) {
  state.activeProject = p;
  state.projectTab = 'board';
  await loadProjectTabData();
  app.render();
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
        app.render();
        scrollChatToBottom();
      }
    });
  }
  if (state.projectTab === 'checkins') state.projectCheckins = await fetchCheckins(pid);
}

// ── Task Modal Events ─────────────────────────────────────────────────
function attachTaskModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.taskModal = null; state.taskEditData = null; state.taskEntityContext = null; overlay.remove(); app.render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-delete-task')?.addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    await deleteTask(state.taskEditData.id);
    state.tasks = await fetchTasks();
    showToast('Task deleted', 'success');
    closeModal();
  });
  document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ctx = state.taskEntityContext || {};
    try {
      if (state.taskEditData?.id) {
        await updateTask(state.taskEditData.id, {
          title: fd.get('title'), description: fd.get('description'),
          assigned_to: fd.get('assigned_to') || null, due_date: fd.get('due_date') || null,
          status: fd.get('status') || state.taskEditData.status,
        });
        showToast('Task updated', 'success');
      } else {
        await createTask({
          title: fd.get('title'), description: fd.get('description'),
          assigned_to: fd.get('assigned_to') || null, due_date: fd.get('due_date') || null,
          entity_type: ctx.entity_type || null, entity_id: ctx.entity_id || null,
          entity_label: ctx.entity_label || null,
        });
        showToast('Task assigned — notification sent ✓', 'success');
      }
      state.tasks = await fetchTasks();
      closeModal();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });
}

// ── Task Events ──────────────────────────────────────────────────────
function attachTaskEvents() {
  // Open task modal from Tasks view
  document.getElementById('btn-new-task')?.addEventListener('click', () => {
    state.taskModal = 'new'; state.taskEditData = null; state.taskEntityContext = null; app.render();
  });

  // Task filter chips
  document.querySelectorAll('[data-task-filter]').forEach(el => {
    el.addEventListener('click', () => { state.taskFilter = el.dataset.taskFilter; app.render(); });
  });

  // Click to edit task
  document.querySelectorAll('[data-edit-task]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === el.dataset.editTask);
      if (!task) return;
      if (state.team.length === 0) state.team = await fetchTeam();
      state.taskModal = 'edit'; state.taskEditData = task; state.taskEntityContext = null; app.render();
    });
  });

  // Assign task from submission card
  document.querySelectorAll('[data-assign-task]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.team.length === 0) state.team = await fetchTeam();
      state.taskModal = 'new';
      state.taskEditData = null;
      state.taskEntityContext = {
        entity_type: btn.dataset.taskEntityType,
        entity_id: btn.dataset.assignTask,
        entity_label: btn.dataset.taskEntityLabel,
      };
      app.render();
    });
  });

  // Status change from task list
  document.querySelectorAll('[data-task-status]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      await updateTask(sel.dataset.taskStatus, { status: sel.value });
      state.tasks = await fetchTasks();
      showToast('Task status updated', 'success');
      app.render();
    });
  });
}

function scrollChatToBottom() {
  setTimeout(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}


export { renderProjects, renderTasksView, renderTaskModal, attachProjectEvents, attachTaskEvents, attachTaskModalEvents, openProject };
