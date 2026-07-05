import { supabase } from './supabase.js';
import { currentUser } from './auth.js';
import { sendNotification } from './notifications.js';

// 6-stage workflow
// brief → in_production → awaiting_review → approved → scheduled → published
// (rejected is a terminal state from awaiting_review)

export const POST_STAGES = [
  { id: 'brief',          label: 'Brief',           color: '#8b5cf6', desc: 'Idea captured, ready to produce' },
  { id: 'in_production',  label: 'In Production',   color: '#f59e0b', desc: 'Content being created' },
  { id: 'awaiting_review',label: 'Awaiting Review',  color: '#3b82f6', desc: 'Submitted for leadership approval' },
  { id: 'approved',       label: 'Approved',         color: '#10b981', desc: 'Signed off by leadership' },
  { id: 'scheduled',      label: 'Scheduled',        color: '#6366f1', desc: 'Queued with a post date' },
  { id: 'published',      label: 'Published',        color: '#059669', desc: 'Live on social media' },
  { id: 'rejected',       label: 'Rejected',         color: '#ef4444', desc: 'Changes requested' },
];

// Map old DB values to new display labels (backward compat)
export const STAGE_LABEL_MAP = {
  draft: 'Brief',
  pending_approval: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  published: 'Published',
  brief: 'Brief',
  in_production: 'In Production',
  awaiting_review: 'Awaiting Review',
};

export function getStage(status) {
  return POST_STAGES.find(s => s.id === status) ||
    POST_STAGES.find(s => s.id === (status === 'draft' ? 'brief' : status === 'pending_approval' ? 'awaiting_review' : status)) ||
    POST_STAGES[0];
}

export async function fetchSocialPosts() {
  if (!supabase) return [];
  const { data } = await supabase.from('social_posts')
    .select('*, author:author_id(full_name), approvals:post_approvals(*, approver:approver_id(full_name))')
    .order('scheduled_date', { ascending: true, nullsFirst: false });
  return data || [];
}

// Map new UI stage names to DB-valid values (before migration is run)
function toDbStatus(uiStatus) {
  const map = { brief: 'draft', in_production: 'draft', awaiting_review: 'pending_approval' };
  return map[uiStatus] || uiStatus;
}

export async function createSocialPost(post, approverIds) {
  if (!supabase) return null;
  const rawStatus = approverIds?.length ? 'pending_approval' : toDbStatus(post.status || 'draft');
  const status = rawStatus;
  const { data, error } = await supabase.from('social_posts').insert({
    content: post.content,
    platforms: post.platforms || [],
    scheduled_date: post.scheduled_date || null,
    status,
    author_id: currentUser.id,
    notes: post.notes || '',
  }).select().single();
  if (error) throw error;

  if (approverIds?.length) {
    const approvals = approverIds.map(uid => ({ post_id: data.id, approver_id: uid }));
    await supabase.from('post_approvals').insert(approvals);
    for (const uid of approverIds) {
      await sendNotification(uid, 'approval_request',
        'Post needs your approval',
        `${currentUser.email} submitted a post for your approval`,
        'social-planner'
      );
    }
  }
  return data;
}

export async function batchCreateJulyPlan(authorId) {
  if (!supabase) return;
  const posts = getJulyPlan(authorId);
  const { data, error } = await supabase.from('social_posts').insert(posts).select();
  if (error) throw error;
  return data;
}

export async function approvePost(approvalId, postId, approved, comment) {
  if (!supabase) return;
  await supabase.from('post_approvals').update({
    status: approved ? 'approved' : 'rejected',
    comment: comment || '',
    responded_at: new Date().toISOString(),
  }).eq('id', approvalId);

  const { data: approvals } = await supabase.from('post_approvals').select('*').eq('post_id', postId);
  const allResponded = approvals?.every(a => a.status !== 'pending');
  const allApproved = approvals?.every(a => a.status === 'approved');

  if (allResponded) {
    const newStatus = allApproved ? 'approved' : 'rejected';
    await supabase.from('social_posts').update({ status: newStatus }).eq('id', postId);
    const { data: post } = await supabase.from('social_posts').select('author_id').eq('id', postId).single();
    if (post) {
      await sendNotification(post.author_id, 'approval_result',
        `Post ${allApproved ? 'approved ✓' : 'rejected'}`,
        `Your post has been ${allApproved ? 'approved by all reviewers' : 'rejected — check comments'}`,
        'social-planner'
      );
    }
  }
}

export async function updatePostStatus(id, status) {
  if (!supabase) return;
  const dbStatus = toDbStatus(status);
  const updates = { status: dbStatus, updated_at: new Date().toISOString() };
  if (dbStatus === 'published') updates.posted_at = new Date().toISOString();
  await supabase.from('social_posts').update(updates).eq('id', id);
}

export async function deleteSocialPost(id) {
  if (!supabase) return;
  await supabase.from('social_posts').delete().eq('id', id);
}

function getJulyPlan(authorId) {
  const plan = [
    { day: '2026-07-06', platform: ['LinkedIn'], content: `🚀 Big announcement: IT Impact Consulting is launching a new AI transformation practice this July.\n\nWe've helped PE-backed firms, dental groups, and healthcare networks modernise their IT from the ground up — and now we're taking it further.\n\nAI isn't a future concern. It's a now concern. Is your IT infrastructure ready?\n\n#AITransformation #ITConsulting #DigitalTransformation` },
    { day: '2026-07-07', platform: ['LinkedIn','Instagram'], content: `Most organisations have data. Very few use it well.\n\nThe difference between a good IT strategy and a great one? Knowing which data signals matter — and acting on them before your competitors do.\n\nIT Impact Consulting helps leadership teams build the infrastructure to make data-driven decisions at speed.\n\n#DataStrategy #ITLeadership #BusinessGrowth` },
    { day: '2026-07-08', platform: ['LinkedIn'], content: `Case Study Spotlight 💡\n\nA PE-backed healthcare firm came to us with 6 separate IT systems that couldn't talk to each other. No unified reporting. No visibility.\n\nIn 90 days, we consolidated their stack, automated their reporting, and delivered a live dashboard the board actually uses.\n\nThis is what smart IT looks like.\n\n#PrivateEquity #HealthcareIT #DigitalTransformation` },
    { day: '2026-07-09', platform: ['LinkedIn','Facebook'], content: `Hiring the right IT leader is hard. Finding one who understands both technology AND your business model? Even harder.\n\nAt IT Impact Consulting, we sit at the intersection of technology and strategy — bridging the gap between your IT team and your executive vision.\n\nThat's the difference between a vendor and a partner.\n\n#ITStrategy #BusinessTransformation #TechLeadership` },
    { day: '2026-07-10', platform: ['LinkedIn'], content: `5 signs your IT infrastructure is holding back your growth:\n\n1️⃣ Your team spends more time fixing systems than building products\n2️⃣ You can't get a clear technology audit in under a week\n3️⃣ Onboarding new staff takes longer than it should\n4️⃣ Your data lives in silos with no central view\n5️⃣ You've postponed a digital initiative due to IT constraints\n\nAny of these sound familiar? Let's talk.\n\n#ITConsulting #GrowthStrategy #DigitalTransformation` },
    { day: '2026-07-13', platform: ['LinkedIn','Instagram'], content: `AI readiness isn't about having the latest tools.\n\nIt's about having clean data, integrated systems, and a team that knows how to act on AI outputs.\n\nMost organisations are 12-18 months away from true AI readiness — and don't know it yet.\n\nWe help you close that gap.\n\n#AIReadiness #DigitalStrategy #ITConsulting` },
    { day: '2026-07-14', platform: ['LinkedIn'], content: `The best technology decisions aren't made by technologists alone.\n\nThey're made when business leaders and IT leaders are in the same room, speaking the same language.\n\nIT Impact Consulting acts as that translator — helping CEOs, CFOs, and COOs understand what their technology is telling them.\n\n#ITLeadership #ExecutiveAdvisory #BusinessTech` },
    { day: '2026-07-15', platform: ['LinkedIn','Facebook'], content: `What does a 100-hour IT audit actually look like?\n\n✅ Full infrastructure review\n✅ Security vulnerability assessment\n✅ Vendor contract analysis\n✅ Team capability mapping\n✅ 90-day transformation roadmap\n\nWe've done this for PE-backed firms, dental groups, and healthcare networks. The results don't lie.\n\nDM us to learn more.\n\n#ITAudit #DigitalTransformation #PrivateEquity` },
    { day: '2026-07-16', platform: ['LinkedIn'], content: `Healthcare IT is uniquely complex.\n\nYou're managing patient data, compliance requirements, multiple clinical systems, and the constant pressure to do more with less.\n\nIT Impact Consulting specialises in helping healthcare organisations modernise without disruption — keeping care at the centre.\n\n#HealthcareIT #DigitalHealth #ITConsulting` },
    { day: '2026-07-17', platform: ['LinkedIn','Instagram'], content: `Your IT vendor isn't your strategic partner. They're selling you a product.\n\nA true IT partner asks: what are you trying to achieve in the next 3 years — and how does your technology need to evolve to get you there?\n\nThat's the question we start every engagement with.\n\n#ITStrategy #TechPartnership #BusinessGrowth` },
    { day: '2026-07-20', platform: ['LinkedIn'], content: `Dental groups are scaling fast — and IT is struggling to keep up.\n\nFrom multi-location practice management to patient experience technology, the digital demands on dental organisations have never been higher.\n\nIT Impact Consulting has deep experience helping dental networks build the IT foundation to scale confidently.\n\n#DentalIT #HealthcareDigital #PracticeManagement` },
    { day: '2026-07-21', platform: ['LinkedIn','Facebook'], content: `Insight: 73% of digital transformation projects fail — not because of the technology, but because of poor implementation strategy.\n\nThe tools matter. The plan matters more.\n\nIT Impact Consulting builds the roadmap before we build anything else.\n\n#DigitalTransformation #ITStrategy #ChangeManagement` },
    { day: '2026-07-22', platform: ['LinkedIn'], content: `We asked a group of PE portfolio company CTOs: "What keeps you up at night?"\n\nThe top answers:\n🔴 Cybersecurity vulnerabilities\n🔴 Lack of visibility into IT spend\n🔴 Outdated legacy systems\n🔴 Inability to scale quickly post-acquisition\n\nThese are exactly the problems IT Impact was built to solve.\n\n#PrivateEquity #PortfolioOperations #ITConsulting` },
    { day: '2026-07-23', platform: ['LinkedIn','Instagram'], content: `Technology should give you leverage — not create new problems.\n\nWhen your stack is fragmented, your reporting is manual, and your team is firefighting, you're losing hours every day.\n\nIT Impact Consulting is the fix.\n\n#ITConsulting #Efficiency #DigitalTransformation` },
    { day: '2026-07-24', platform: ['LinkedIn'], content: `Post-acquisition IT integration is one of the most underestimated challenges in PE.\n\nTwo companies. Two cultures. Two tech stacks. One deadline.\n\nWe've been through this dozens of times. Our playbook reduces integration timelines by up to 40%.\n\nLet us show you how.\n\n#MergersAndAcquisitions #PostMergerIntegration #PrivateEquity` },
    { day: '2026-07-27', platform: ['LinkedIn','Facebook'], content: `AI tools are only as good as the data they're trained on.\n\nBefore your organisation invests in AI, ask: Is our data clean? Is it structured? Do we even know where all of it lives?\n\nIT Impact Consulting conducts AI readiness assessments that answer exactly these questions.\n\n#AIReadiness #DataGovernance #ITStrategy` },
    { day: '2026-07-28', platform: ['LinkedIn'], content: `What we believe at IT Impact Consulting:\n\n💡 Technology is not the strategy — it enables the strategy\n💡 Speed matters, but sustainable speed matters more\n💡 The best IT solutions are the ones your team actually uses\n💡 A great IT partner makes themselves less necessary over time\n\nThis is how we work.\n\n#ITValues #Consulting #Leadership` },
    { day: '2026-07-29', platform: ['LinkedIn','Instagram'], content: `The organisations winning with technology right now have one thing in common: they treated IT as a strategic function, not a support function.\n\nThey invested in the right systems, the right talent, and the right partnerships — before they needed to.\n\nIs your IT strategy ahead of your growth curve?\n\n#ITLeadership #StrategicIT #BusinessGrowth` },
    { day: '2026-07-30', platform: ['LinkedIn'], content: `A message to PE operating partners:\n\nThe 100-day plan is critical. But the IT piece is often left until month 3 or 4.\n\nBy then, bad habits are set, data is fragmented, and the team has built workarounds that take months to undo.\n\nIT Impact helps you move IT to the top of the 100-day agenda. The ROI is measurable.\n\n#PrivateEquity #PortfolioOperations #ValueCreation` },
    { day: '2026-07-31', platform: ['LinkedIn','Facebook'], content: `Wrapping up July with gratitude.\n\nTo every client who trusted us with their technology transformation this month — thank you. The work is only meaningful because of the impact it creates for your teams and the people you serve.\n\nMore to come in August. Big things ahead.\n\n#ITImpact #Consulting #Grateful` },
  ];

  return plan.map(p => ({
    content: p.content,
    platforms: p.platform,
    scheduled_date: p.day + 'T09:00:00Z',
    status: 'draft',
    author_id: authorId,
  }));
}
