// Inbox page: website contact submissions + notifications.
// The bell slide-over panel is kept; a full-page Notifications tab was added
// so notifications are also reachable as a first-class Inbox view.
import { state, timeAgo, app } from '../app-core.js';
import { submissionCard, CONTACT_STATUSES } from './submissions-shared.js';
import { fetchNotifications, getUnreadCount, markAsRead, markAllRead } from '../notifications.js';

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
        ${s.service_interest?.length ? `<div style="margin-bottom:10px"><span style="font-family:Arial,sans-serif;font-size:10px;color:var(--text-3);text-transform:uppercase">Interested in:</span> <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${s.service_interest.map(i=>`<span class="rec-tag">${i}</span>`).join('')}</div></div>` : ''}
        ${s.message ? `<div style="font-size:13px;color:var(--text-2);line-height:1.7;background:var(--bg-2);padding:12px 14px;border-radius:8px">${s.message}</div>` : ''}
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
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:16px;color:var(--text)">Notifications</div>
      <div style="display:flex;gap:8px">
        <button id="btn-mark-all-read" style="font-family:Arial,sans-serif;font-size:10px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer">Mark all read</button>
        <button id="btn-close-notif" style="font-family:Arial,sans-serif;font-size:12px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer">✕</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px">
      ${state.notifications.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-3);font-family:DM Mono,monospace;font-size:12px">No notifications yet</div>' : ''}
      ${state.notifications.map(n => `
        <div style="padding:12px 14px;border-radius:8px;margin-bottom:4px;background:${n.read?'transparent':'var(--accent-glow)'};cursor:pointer;transition:background 0.15s" data-notif-id="${n.id}" data-notif-link="${n.link||''}">
          <div style="font-size:12px;font-weight:${n.read?'400':'600'};color:var(--text);margin-bottom:3px">${n.title}</div>
          <div style="font-size:11px;color:var(--text-2);line-height:1.5">${n.body||''}</div>
          <div style="font-family:Arial,sans-serif;font-size:9px;color:var(--text-3);margin-top:4px">${timeAgo(n.created_at)}</div>
        </div>`).join('')}
    </div>
  </div>
  <style>@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}</style>`;
}

// ── Notification Events ──────────────────────────────────────────────
function attachNotifEvents() {
  document.getElementById('btn-close-notif')?.addEventListener('click', () => { state.showNotifPanel = false; app.render(); });
  document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
    await markAllRead();
    state.notifications = await fetchNotifications();
    state.unreadCount = 0;
    app.render();
  });
  document.querySelectorAll('[data-notif-id]').forEach(el => {
    el.addEventListener('click', async () => {
      await markAsRead(el.dataset.notifId);
      state.notifications = await fetchNotifications();
      state.unreadCount = await getUnreadCount();
      const link = el.dataset.notifLink;
      if (link) { state.view = link; state.showNotifPanel = false; }
      app.render();
    });
  });
}


// Full-page Notifications view (Inbox > Notifications tab). New in restructure:
// renders the same data as the bell panel, as a page instead of a slide-over.
function renderNotificationsView() {
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Notifications</div>
      <div class="page-sub">${state.notifications.length} notifications · ${state.unreadCount} unread</div>
    </div>
    <button class="btn-ghost" id="btn-page-mark-all-read" style="font-size:12px">Mark all read</button>
  </div>
  <div class="rec-cands-list">
    ${state.notifications.length === 0 ? '<div class="social-empty">No notifications yet.</div>' : ''}
    ${state.notifications.map(n => `
      <div class="rec-cand-card" style="cursor:pointer;${n.read ? '' : 'border-left:3px solid var(--accent)'}" data-notif-id="${n.id}" data-notif-link="${n.link||''}">
        <div class="rec-cand-body">
          <div style="font-size:13px;font-weight:${n.read?'400':'700'};color:var(--text);margin-bottom:3px">${n.title}</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.5">${n.body||''}</div>
          <div style="font-family:Arial,sans-serif;font-size:10px;color:var(--text-3);margin-top:4px">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

function attachNotificationsViewEvents() {
  document.getElementById('btn-page-mark-all-read')?.addEventListener('click', async () => {
    await markAllRead();
    state.notifications = await fetchNotifications();
    state.unreadCount = 0;
    app.render();
  });
}

export { renderContactSubmissions, renderNotifPanel, attachNotifEvents, renderNotificationsView, attachNotificationsViewEvents };
