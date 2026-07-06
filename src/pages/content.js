// Content page: Social Planner (6-stage approvals), Articles (with AI writer)
// and the static LinkedIn Content Engine.
import { state, escHtml, showToast, app } from '../app-core.js';
import { currentUser } from '../auth.js';
import { fetchArticles, createArticle, updateArticle, deleteArticle } from '../articles.js';
import {
  fetchSocialPosts, createSocialPost, approvePost, updatePostStatus,
  deleteSocialPost, batchCreateJulyPlan, POST_STAGES, getStage,
} from '../social-planner.js';
import { fetchTeamMembers as fetchTeam } from '../team.js';

// ── Social Media Post Generator ───────────────────────────────────────
const SOCIAL_POSTS = {
  linkedin: {
    casestudy: {
      sound: {
        title: 'Sound Physicians Case Study',
        post: `We ran a full IT assessment across a $1B+ physician group with 4,000+ providers.\n\nHere's what we found in the first 30 days:\n\n• 7 disconnected EMR integrations with no shared data layer\n• 3 separate "AI initiatives" with no unified infrastructure\n• A CIO role that had been vacant for 11 months\n\nThe 100-day plan:\n1. Map every data flow across the organization\n2. Build the AI/LLM infrastructure layer\n3. Establish fractional CIO leadership with embedded talent\n\nResult: Live AI infrastructure across the entire provider network. Ahead of schedule.\n\nThe lesson: PE-backed healthcare platforms don't need more AI pilots. They need the infrastructure to run them at scale.\n\n#HealthcareIT #FractionalCIO #AIInfrastructure #PrivateEquity`,
      },
      oshi: {
        title: 'Oshi Health Case Study',
        post: `100-hour IT audit. 1 company. Everything changed.\n\nOshi Health brought us in for a rapid IT assessment post-funding round.\n\nWhat we found:\n• Product and IT orgs operating on separate roadmaps\n• No shared data infrastructure between clinical and operational systems\n• Hiring for a full-time CIO when a fractional engagement was the right move\n\nWhat we delivered:\n• Full product/IT org redesign\n• Unified data architecture\n• Fractional CIO leadership embedded through the transition\n\nRecord-breaking quarterly performance followed.\n\nFractional CIO isn't a compromise. For PE-backed platforms scaling fast, it's the exact right tool.\n\n#HealthTech #PrivateEquity #FractionalCIO #ITLeadership`,
      },
      clove: {
        title: 'Clove Dental Case Study',
        post: `Most dental DSOs scale the operations. Few scale the digital infrastructure.\n\nClove Dental was different — they wanted both.\n\nWe built:\n• A digital front-door experience that matched their brand promise\n• A custom application suite for operational efficiency\n• IT infrastructure designed for multi-state expansion\n• Patient care technology that actually improved outcomes\n\nThe result: A technology layer that could scale as fast as their acquisition strategy.\n\nPE-backed dental DSOs are among the most interesting IT challenges in healthcare today. The complexity of multi-state operations + consumer brand expectations + clinical compliance = an infrastructure problem that most CIOs don't have time to solve alone.\n\nThat's where fractional CIO leadership creates the most leverage.\n\n#DentalDSO #HealthcareIT #FractionalCIO #PrivateEquity`,
      },
    },
    insight: {
      pe: {
        title: 'PE IT Insight',
        post: `PE firms spend months on financial due diligence.\n\nMost spend less than 2 days on IT due diligence.\n\nHere's what gets missed:\n\n• Legacy ERP systems that block the integration thesis\n• Security debt that becomes a liability post-close\n• Data infrastructure that can't support the AI roadmap the board wants\n• IT leadership gaps that don't surface until the 100-day plan stalls\n\nThe firms that catch this early don't have better financial models.\n\nThey have an IT operating partner who's done this before.\n\n#PrivateEquity #ITDueDiligence #ValueCreation #FractionalCIO`,
      },
      ai: {
        title: 'AI in Healthcare',
        post: `Every PE-backed healthcare platform now has an "AI strategy."\n\nMost will fail to execute.\n\nNot because the models aren't good enough.\nBecause the infrastructure underneath them isn't built for production.\n\nThe 3 things that kill healthcare AI deployments:\n\n1. No unified data layer across systems (EMR, billing, ops all siloed)\n2. No embedded technical leadership to drive adoption\n3. Pilots that work in isolation but break at scale\n\nSound Physicians ran into all three. We fixed all three.\n\nAI in healthcare isn't a strategy problem. It's an infrastructure problem.\n\n#HealthcareAI #AIInfrastructure #FractionalCIO #DigitalHealth`,
      },
    },
    hottake: {
      cio: {
        title: 'Hot Take: Full-Time CIO',
        post: `Hiring a full-time CIO for your PE portfolio company is almost always the wrong move in years 1–3.\n\nControversial? Maybe. But here's the math:\n\n• Full-time CIO: $350K–$500K fully loaded + 6-month search timeline\n• Fractional CIO: Engaged in 2 weeks, embedded immediately, 30–60% of the cost\n\nMore importantly:\n\nA full-time CIO hire signals you know exactly what you need. Most PE portfolio companies don't — they need someone who can assess, prioritize, and build the roadmap BEFORE you hire permanently.\n\nFractional CIO isn't a budget play.\n\nIt's the right sequence.\n\nAssess → Build → Hire permanent when you know exactly what you need.\n\n#PrivateEquity #FractionalCIO #ITLeadership #ValueCreation`,
      },
    },
    question: {
      dso: {
        title: 'Engagement Question',
        post: `Question for anyone in PE-backed healthcare or dental:\n\nWhat's the #1 IT mistake you've seen portfolio companies make in the first 90 days post-acquisition?\n\nFor us, it's almost always the same answer: assuming the inherited tech stack is good enough to scale.\n\nIt never is.\n\n#PrivateEquity #HealthcareIT #DentalDSO #ITLeadership`,
      },
    },
  },
};

function getPostContent() {
  const p = SOCIAL_POSTS;
  const platform = state.socialPlatform;
  const type = state.socialPostType;
  const angle = state.socialAngle;
  try {
    return p[platform]?.[type]?.[angle] || null;
  } catch { return null; }
}

// ── Articles View ────────────────────────────────────────────────────
function renderArticlesView() {
  const cats = ['all', ...new Set(state.articles.map(a => a.category).filter(Boolean))];
  const filtered = state.articleFilter === 'all' ? state.articles : state.articles.filter(a => a.category === state.articleFilter);
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Articles</div>
      <div class="page-sub">${state.articles.length} articles · knowledge base</div>
    </div>
    <button class="find-leads-btn" id="btn-new-article">+ New Article</button>
  </div>
  <div class="stage-bar" style="margin-bottom:20px">
    ${cats.map(c => `<div class="stage-chip ${state.articleFilter===c?'active':''}" data-article-filter="${c}">${c==='all'?'All ('+state.articles.length+')':c}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
    ${filtered.map(a => `
      <div class="rec-pos-card" style="cursor:pointer" data-edit-article="${a.id}">
        ${a.cover_image ? `<div style="height:140px;background:url('${a.cover_image}') center/cover;border-radius:12px 12px 0 0"></div>` : `<div style="height:60px;background:linear-gradient(135deg,var(--accent-glow),var(--bg-3));border-radius:12px 12px 0 0"></div>`}
        <div style="padding:16px 18px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="cand-status-pill" style="background:${a.status==='published'?'var(--green-glow)':a.status==='draft'?'rgba(90,90,114,0.15)':'var(--amber-glow)'};color:${a.status==='published'?'var(--green)':a.status==='draft'?'var(--text-3)':'var(--amber)'}">${a.status}</span>
            <span style="font-size:10px;color:var(--text-3)">${a.category||'general'}</span>
          </div>
          <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:6px">${a.title}</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${(a.body||'').replace(/[#*_]/g,'').substring(0,200)}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:10px">${a.author?.full_name||'Unknown'} · ${new Date(a.created_at).toLocaleDateString()}</div>
        </div>
      </div>`).join('')}
    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px;grid-column:1/-1">No articles yet. Click "+ New Article" to create one.</div>' : ''}
  </div>`;
}

function renderArticleModal() {
  const isEdit = !!state.articleEditData?.id;
  const a = state.articleEditData || {};
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Article' : 'New Article'}</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="article-form" style="padding:20px 28px 24px">
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Title *</label>
          <input type="text" name="title" required value="${escHtml(a.title||'')}" style="width:100%;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px;outline:none;font-weight:600" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Category</label>
            <input type="text" name="category" value="${escHtml(a.category||'general')}" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Cover Image URL</label>
            <input type="url" name="cover_image" value="${escHtml(a.cover_image||'')}" placeholder="https://..." style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
          </div>
        </div>
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em">Content</label>
            <button type="button" id="btn-ai-write" style="padding:5px 12px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-size:10px;display:flex;align-items:center;gap:5px">✨ AI Write</button>
          </div>
          <div id="ai-write-panel" style="display:none;margin-bottom:10px;padding:12px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border)">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input id="ai-topic" placeholder="Article topic or instructions..." style="flex:1;min-width:180px;padding:8px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none" />
              <select id="ai-tone" style="padding:8px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;">
                <option value="professional">Professional</option>
                <option value="authoritative">Authoritative</option>
                <option value="conversational">Conversational</option>
              </select>
              <select id="ai-length" style="padding:8px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;">
                <option value="medium">Medium (~800 words)</option>
                <option value="short">Short (~500 words)</option>
                <option value="long">Long (~1500 words)</option>
              </select>
              <button type="button" id="btn-ai-generate" style="padding:8px 14px;border-radius:6px;border:none;background:var(--gradient-accent);color:#fff;cursor:pointer;font-weight:700;font-size:12px">Generate</button>
            </div>
            <div id="ai-write-status" style="font-size:11px;color:var(--text-3);margin-top:8px"></div>
          </div>
          <textarea name="body" id="article-body" rows="12" style="width:100%;padding:12px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text-2);font-size:13px;outline:none;resize:vertical;line-height:1.7">${escHtml(a.body||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center">
          ${isEdit ? `<button type="button" id="btn-delete-article" style="margin-right:auto;padding:9px 16px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-size:12px">Delete</button>` : ''}
          <select name="status" style="padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;outline:none;">
            <option value="draft" ${a.status==='draft'||!a.status?'selected':''}>Draft</option>
            <option value="published" ${a.status==='published'?'selected':''}>Published</option>
          </select>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-weight:700;font-size:13px">${isEdit?'Save':'Create Article'}</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Social Planner View ──────────────────────────────────────────────
function renderSocialPlanner() {
  const stageIds = ['all', ...POST_STAGES.map(s => s.id)];
  const filtered = state.socialPostFilter === 'all' ? state.socialPosts : state.socialPosts.filter(p => p.status === state.socialPostFilter);
  const julyExists = state.socialPosts.length >= 15;
  return `
  <div class="page-header pipe-header">
    <div>
      <div class="page-title">Social Media Planner</div>
      <div class="page-sub">${state.socialPosts.length} posts · 6-stage approval workflow</div>
    </div>
    <div style="display:flex;gap:8px">
      ${!julyExists ? `<button class="btn-ghost" id="btn-july-plan" style="font-size:12px">📅 Load July Plan</button>` : ''}
      <button class="find-leads-btn" id="btn-new-social-post">+ New Post</button>
    </div>
  </div>

  <!-- Stage pipeline bar -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:18px">
    ${POST_STAGES.filter(s => s.id !== 'rejected').map(s => {
      const count = state.socialPosts.filter(p => p.status === s.id || (s.id === 'brief' && (p.status === 'draft' || !p.status))).length;
      return `<div style="padding:10px 12px;background:var(--bg-1);border:1px solid ${state.socialPostFilter===s.id?s.color:'var(--border)'};border-radius:8px;cursor:pointer;text-align:center;transition:all 0.15s" data-sp-filter="${s.id}">
        <div style="font-size:9px;color:${s.color};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${s.label}</div>
        <div style="font-weight:800;font-size:20px;color:var(--text)">${count}</div>
      </div>`;
    }).join('')}
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:${state.linkedinConnected?'var(--green-light)':'var(--bg-1)'};border:1px solid ${state.linkedinConnected?'rgba(16,185,129,0.25)':'var(--border)'};border-radius:var(--radius);margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">💼</span>
      <div style="font-weight:700;font-size:13px;color:var(--text)">LinkedIn ${state.linkedinConnected?'— Connected ✓':'— Not Connected'}</div>
    </div>
    <div style="display:flex;gap:8px">
      ${!state.linkedinConnected ? `<button class="find-leads-btn" id="btn-connect-linkedin" style="padding:8px 16px;font-size:12px">Connect LinkedIn</button>` : ''}
      <button class="btn-ghost" id="btn-connect-instagram" style="padding:8px 16px;font-size:12px">📸 Connect Instagram</button>
      <button class="btn-ghost" id="btn-connect-facebook" style="padding:8px 16px;font-size:12px">📘 Connect Facebook</button>
    </div>
  </div>

  <div class="stage-bar" style="margin-bottom:20px">
    <div class="stage-chip ${state.socialPostFilter==='all'?'active':''}" data-sp-filter="all">All (${state.socialPosts.length})</div>
    ${POST_STAGES.map(s => {
      const count = state.socialPosts.filter(p => p.status === s.id || (s.id === 'brief' && p.status === 'draft')).length;
      return `<div class="stage-chip ${state.socialPostFilter===s.id?'active':''}" data-sp-filter="${s.id}" style="${state.socialPostFilter===s.id?'border-color:'+s.color+';color:'+s.color:''}">${s.label} (${count})</div>`;
    }).join('')}
  </div>

  <div class="rec-cands-list">
    ${filtered.map(p => {
      const stage = getStage(p.status);
      const sc = stage.color;
      const pendingForMe = (p.approvals||[]).find(a => a.approver_id === currentUser?.id && a.status === 'pending');
      const canPublish = state.linkedinConnected && (p.platforms||[]).includes('LinkedIn') && p.status === 'approved';
      const scheduledDate = p.scheduled_date ? new Date(p.scheduled_date) : null;
      return `
      <div class="rec-cand-card">
        <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,${sc},${sc}aa);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📱</div>
        <div class="rec-cand-body">
          <div class="rec-cand-top">
            <div style="flex:1">
              <div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(p.content)}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
                ${(p.platforms||[]).map(pl => `<span style="font-size:9px;padding:2px 7px;border-radius:4px;background:var(--accent-glow);color:var(--accent-2);border:1px solid rgba(99,102,241,0.2)">${pl}</span>`).join('')}
              </div>
              ${canPublish ? `<button data-publish-linkedin="${p.id}" style="margin-top:4px;padding:5px 12px;border-radius:6px;border:none;background:#0a66c2;color:#fff;cursor:pointer;font-size:11px">🚀 Publish to LinkedIn</button>` : ''}
              <div style="font-size:10px;color:var(--text-3);margin-top:4px">
                ${p.author?.full_name||'Unknown'} · ${new Date(p.created_at).toLocaleDateString()}
                ${scheduledDate ? ' · 📅 '+scheduledDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ''}
                ${p.posted_at ? ' · ✅ Posted '+new Date(p.posted_at).toLocaleDateString() : ''}
              </div>
              ${(p.approvals||[]).length ? `
                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                  ${(p.approvals||[]).map(a => `
                    <span style="font-size:10px;padding:3px 8px;border-radius:4px;background:${a.status==='approved'?'var(--green-glow)':a.status==='rejected'?'var(--red-glow)':'var(--amber-glow)'};color:${a.status==='approved'?'var(--green)':a.status==='rejected'?'var(--red)':'var(--amber)'}">${a.approver?.full_name||'?'}: ${a.status}</span>
                  `).join('')}
                </div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
              <select class="cand-status-select" data-sp-status="${p.id}" onclick="event.stopPropagation()" style="font-size:11px;padding:4px 8px;border-color:${sc}44;color:${sc}">
                ${POST_STAGES.map(s => `<option value="${s.id}" ${p.status===s.id||(s.id==='brief'&&p.status==='draft')?'selected':''}>${s.label}</option>`).join('')}
              </select>
              <button data-delete-social-post="${p.id}" style="padding:4px 8px;border-radius:5px;border:1px solid rgba(239,68,68,0.3);background:var(--red-glow);color:var(--red);cursor:pointer;font-size:10px">Delete</button>
              ${pendingForMe ? `
                <div style="display:flex;gap:4px">
                  <button data-approve-post="${pendingForMe.id}" data-post-id="${p.id}" style="padding:5px 10px;border-radius:5px;border:none;background:var(--green-glow);color:var(--green);cursor:pointer;font-size:10px;font-weight:500">✓ Approve</button>
                  <button data-reject-post="${pendingForMe.id}" data-post-id="${p.id}" style="padding:5px 10px;border-radius:5px;border:none;background:var(--red-glow);color:var(--red);cursor:pointer;font-size:10px;font-weight:500">✕ Reject</button>
                </div>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text-3);font-size:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:12px">No posts in this stage.</div>' : ''}
  </div>`;
}

function renderSocialPostModal() {
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <div class="modal-title">New Social Post</div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="social-post-form" style="padding:20px 28px 24px">
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Post Content *</label>
          <textarea name="content" required rows="5" placeholder="Write your post..." style="width:100%;padding:12px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;resize:vertical;line-height:1.7"></textarea>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Platforms</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="platform-chips">
            ${['LinkedIn','Facebook','Instagram','Twitter'].map(p => `
              <label style="font-size:11px;padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px">
                <input type="checkbox" name="platforms" value="${p}" style="accent-color:var(--accent)" /> ${p}
              </label>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Schedule Date (optional)</label>
          <input type="datetime-local" name="scheduled_date" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none" />
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Stage</label>
          <select name="status" style="width:100%;padding:9px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;">
            ${POST_STAGES.filter(s => s.id !== 'rejected').map(s => `<option value="${s.id}">${s.label} — ${s.desc}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px">Send for Approval To (optional)</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="approver-chips">
            ${state.team.filter(m => m.id !== currentUser?.id).map(m => `
              <label style="font-size:11px;padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-3);cursor:pointer;display:flex;align-items:center;gap:6px">
                <input type="checkbox" name="approvers" value="${m.id}" style="accent-color:var(--accent)" ${['Ali Faruqi','Abu Bakar'].some(n => (m.full_name||'').includes(n)) ? 'checked' : ''} /> ${m.full_name||m.email}
              </label>`).join('')}
            ${state.team.filter(m => m.id !== currentUser?.id).length === 0 ? '<span style="font-size:11px;color:var(--text-3)">No other team members yet</span>' : ''}
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" id="modal-close-btn" style="padding:9px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg-3);color:var(--text-2);cursor:pointer;font-size:12px">Cancel</button>
          <button type="submit" style="padding:9px 20px;border-radius:6px;border:none;background:var(--gradient-navy);color:#fff;cursor:pointer;font-weight:700;font-size:13px">Create Post</button>
        </div>
      </form>
    </div>
  </div>`;
}

// ── Social Media View ─────────────────────────────────────────────────
function renderSocial() {
  const platforms = [{id:'linkedin',label:'LinkedIn',icon:'in'}];
  const postTypes = [
    {id:'casestudy',label:'Case Study'},
    {id:'insight',label:'Insight'},
    {id:'hottake',label:'Hot Take'},
    {id:'question',label:'Question'},
  ];
  const angles = {
    casestudy: [{id:'sound',label:'Sound Physicians'},{id:'oshi',label:'Oshi Health'},{id:'clove',label:'Clove Dental'}],
    insight:   [{id:'pe',label:'PE IT Due Diligence'},{id:'ai',label:'AI in Healthcare'}],
    hottake:   [{id:'cio',label:'Full-Time CIO Myth'}],
    question:  [{id:'dso',label:'DSO IT Question'}],
  };
  const currentAngles = angles[state.socialPostType] || [];
  const post = getPostContent();

  return `
  <div class="page-header">
    <div class="page-title">Social Media</div>
    <div class="page-sub">LinkedIn content engine · case studies · thought leadership</div>
  </div>

  <div class="social-layout">
    <div class="social-controls">
      <div class="social-section-title">Platform</div>
      <div class="social-platform-tabs">
        ${platforms.map(pl=>`
          <button class="social-tab ${state.socialPlatform===pl.id?'active':''}" data-platform="${pl.id}">
            <span class="social-tab-icon">${pl.icon}</span>${pl.label}
          </button>`).join('')}
      </div>

      <div class="social-section-title" style="margin-top:20px">Post Type</div>
      <div class="social-type-list">
        ${postTypes.map(t=>`
          <button class="social-type-btn ${state.socialPostType===t.id?'active':''}" data-posttype="${t.id}">
            ${t.label}
          </button>`).join('')}
      </div>

      <div class="social-section-title" style="margin-top:20px">Angle / Reference</div>
      <div class="social-type-list">
        ${currentAngles.map(a=>`
          <button class="social-type-btn ${state.socialAngle===a.id?'active':''}" data-angle="${a.id}">
            ${a.label}
          </button>`).join('')}
      </div>
    </div>

    <div class="social-preview">
      ${post ? `
        <div class="social-post-header">
          <div class="social-post-platform">LinkedIn · ${post.title}</div>
          <button class="copy-btn" data-copy="${escHtml(post.post)}" data-label="Post" style="margin-left:auto">Copy Post</button>
        </div>
        <div class="social-post-preview">
          <div class="social-post-author">
            <div class="social-author-avatar">A</div>
            <div>
              <div class="social-author-name">Amish · IT Impact Consulting</div>
              <div class="social-author-sub">Fractional CIO · PE-backed healthcare & dental</div>
            </div>
          </div>
          <div class="social-post-body">${post.post.replace(/\n/g,'<br>')}</div>
          <div class="social-post-actions">
            <span class="social-reaction">👍 Like</span>
            <span class="social-reaction">💬 Comment</span>
            <span class="social-reaction">🔁 Repost</span>
          </div>
        </div>` :
        `<div class="social-empty">Select a post type and angle to generate content</div>`}

      <div class="social-content-ideas">
        <div class="social-section-title" style="margin-top:28px;margin-bottom:14px">Content Ideas This Week</div>
        ${[
          {day:'Mon',type:'Case Study',hook:'Sound Physicians AI infrastructure — what we built in 90 days'},
          {day:'Wed',type:'Insight',hook:'Why PE firms skip IT due diligence (and what it costs them at exit)'},
          {day:'Fri',type:'Hot Take',hook:'Hiring a full-time CIO before you have a roadmap is backwards'},
        ].map(i=>`
          <div class="content-idea-card">
            <div class="content-idea-day">${i.day}</div>
            <div class="content-idea-type">${i.type}</div>
            <div class="content-idea-hook">${i.hook}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── Article Events ───────────────────────────────────────────────────
function attachArticleEvents() {
  document.getElementById('btn-new-article')?.addEventListener('click', () => {
    state.articleModal = true; state.articleEditData = {}; app.render();
  });
  document.querySelectorAll('[data-article-filter]').forEach(el => {
    el.addEventListener('click', () => { state.articleFilter = el.dataset.articleFilter; app.render(); });
  });
  document.querySelectorAll('[data-edit-article]').forEach(el => {
    el.addEventListener('click', () => {
      const a = state.articles.find(x => x.id === el.dataset.editArticle);
      if (a) { state.articleModal = true; state.articleEditData = { ...a }; app.render(); }
    });
  });
}

function attachArticleModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.articleModal = null; state.articleEditData = null; overlay.remove(); app.render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-delete-article')?.addEventListener('click', async () => {
    if (!confirm('Delete this article?')) return;
    await deleteArticle(state.articleEditData.id);
    state.articles = await fetchArticles();
    showToast('Article deleted', 'success');
    closeModal();
  });

  // AI Write button
  document.getElementById('btn-ai-write')?.addEventListener('click', () => {
    const panel = document.getElementById('ai-write-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    // Pre-fill topic from title if empty
    const topicInput = document.getElementById('ai-topic');
    const titleInput = document.querySelector('#article-form [name="title"]');
    if (topicInput && titleInput && !topicInput.value && titleInput.value) {
      topicInput.value = titleInput.value;
    }
  });
  document.getElementById('btn-ai-generate')?.addEventListener('click', async () => {
    const topic = document.getElementById('ai-topic')?.value?.trim();
    if (!topic) { showToast('Enter a topic first', 'error'); return; }
    const tone = document.getElementById('ai-tone')?.value || 'professional';
    const length = document.getElementById('ai-length')?.value || 'medium';
    const statusEl = document.getElementById('ai-write-status');
    const btn = document.getElementById('btn-ai-generate');
    if (statusEl) statusEl.textContent = '✨ Writing article with Claude... (takes ~20 seconds)';
    if (btn) { btn.disabled = true; btn.textContent = 'Writing...'; }
    try {
      const res = await fetch('/api/claude-write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI write failed');
      const bodyEl = document.getElementById('article-body');
      if (bodyEl) bodyEl.value = data.text;
      // Auto-fill title if empty
      const titleEl = document.querySelector('#article-form [name="title"]');
      if (titleEl && !titleEl.value) {
        const firstLine = data.text.split('\n')[0].replace(/^#+\s*/, '');
        titleEl.value = firstLine;
      }
      if (statusEl) statusEl.textContent = '✓ Article generated — review and edit before saving.';
      showToast('Article written by Claude ✓', 'success');
    } catch (err) {
      if (statusEl) statusEl.textContent = '✗ Error: ' + err.message;
      showToast('AI write error: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
    }
  });

  document.getElementById('article-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { title: fd.get('title'), body: fd.get('body'), category: fd.get('category'), cover_image: fd.get('cover_image'), status: fd.get('status') };
    if (state.articleEditData?.id) {
      await updateArticle(state.articleEditData.id, data);
      showToast('Article updated', 'success');
    } else {
      await createArticle(data);
      showToast('Article created!', 'success');
    }
    state.articles = await fetchArticles();
    closeModal();
  });
}

// ── Social Planner Events ────────────────────────────────────────────
function attachSocialPlannerEvents() {
  document.getElementById('btn-new-social-post')?.addEventListener('click', async () => {
    if (state.team.length === 0) state.team = await fetchTeam();
    state.socialPostModal = true; app.render();
  });
  document.querySelectorAll('[data-sp-filter]').forEach(el => {
    el.addEventListener('click', () => { state.socialPostFilter = el.dataset.spFilter; app.render(); });
  });
  document.querySelectorAll('[data-approve-post]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await approvePost(btn.dataset.approvePost, btn.dataset.postId, true);
      state.socialPosts = await fetchSocialPosts();
      showToast('Post approved ✓', 'success');
      app.render();
    });
  });
  document.querySelectorAll('[data-reject-post]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const comment = prompt('Reason for rejection (optional):') || '';
      await approvePost(btn.dataset.rejectPost, btn.dataset.postId, false, comment);
      state.socialPosts = await fetchSocialPosts();
      showToast('Post rejected', 'info');
      app.render();
    });
  });
  // July Plan
  document.getElementById('btn-july-plan')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Loading...';
    try {
      await batchCreateJulyPlan(currentUser.id);
      state.socialPosts = await fetchSocialPosts();
      showToast('July 2026 plan loaded — 20 posts ready ✓', 'success');
      app.render();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      e.target.disabled = false;
      e.target.textContent = '📅 Load July Plan';
    }
  });

  // Delete post
  document.querySelectorAll('[data-delete-social-post]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this post?')) return;
      await deleteSocialPost(btn.dataset.deleteSocialPost);
      state.socialPosts = await fetchSocialPosts();
      showToast('Post deleted', 'success');
      app.render();
    });
  });

  // Status change dropdown
  document.querySelectorAll('[data-sp-status]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      await updatePostStatus(sel.dataset.spStatus, sel.value);
      state.socialPosts = await fetchSocialPosts();
      showToast('Status updated', 'success');
      app.render();
    });
  });

  // Instagram / Facebook placeholders
  document.getElementById('btn-connect-instagram')?.addEventListener('click', () => {
    showToast('Instagram connection requires a Meta Developer App. Contact support to configure.', 'info');
  });
  document.getElementById('btn-connect-facebook')?.addEventListener('click', () => {
    showToast('Facebook connection requires a Meta Developer App. Contact support to configure.', 'info');
  });

  document.getElementById('btn-connect-linkedin')?.addEventListener('click', () => {
    const clientId = '77se4a33m0uhm5';
    const redirectUri = `${location.origin}/api/linkedin-oauth-callback`;
    const scope = encodeURIComponent('openid profile w_member_social');
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    location.href = authUrl;
  });
  document.querySelectorAll('[data-publish-linkedin]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const post = state.socialPosts.find(p => p.id === btn.dataset.publishLinkedin);
      if (!post) return;
      btn.textContent = 'Publishing...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/linkedin-post', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: post.content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to publish');
        await updatePostStatus(post.id, 'published');
        state.socialPosts = await fetchSocialPosts();
        showToast('Published to LinkedIn ✓', 'success');
        app.render();
      } catch (err) {
        showToast('LinkedIn error: ' + err.message, 'error');
        btn.textContent = '🚀 Publish to LinkedIn';
        btn.disabled = false;
      }
    });
  });
}

function attachSocialPostModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const closeModal = () => { state.socialPostModal = null; overlay.remove(); app.render(); };
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('social-post-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const platforms = fd.getAll('platforms');
    const approverIds = fd.getAll('approvers');
    await createSocialPost({
      content: fd.get('content'),
      platforms,
      scheduled_date: fd.get('scheduled_date') || null,
      status: fd.get('status') || 'brief',
    }, approverIds);
    state.socialPosts = await fetchSocialPosts();
    showToast(approverIds.length ? 'Post submitted for approval' : 'Post created!', 'success');
    closeModal();
  });
}

export function attachContentEngineEvents() {
  // Social Media controls
  document.querySelectorAll('[data-platform]').forEach(el => {
    el.addEventListener('click', () => { state.socialPlatform=el.dataset.platform; app.render(); });
  });
  document.querySelectorAll('[data-posttype]').forEach(el => {
    el.addEventListener('click', () => {
      state.socialPostType=el.dataset.posttype;
      const defaultAngles = {casestudy:'sound',insight:'pe',hottake:'cio',question:'dso'};
      state.socialAngle = defaultAngles[state.socialPostType]||'sound';
      app.render();
    });
  });
  document.querySelectorAll('[data-angle]').forEach(el => {
    el.addEventListener('click', () => { state.socialAngle=el.dataset.angle; app.render(); });
  });

}


export {
  renderSocialPlanner, renderSocialPostModal, renderArticlesView, renderArticleModal,
  renderSocial, attachSocialPlannerEvents, attachSocialPostModalEvents,
  attachArticleEvents, attachArticleModalEvents,
};
