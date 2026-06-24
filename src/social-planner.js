import { supabase } from './supabase.js';
import { currentUser } from './auth.js';
import { sendNotification } from './notifications.js';

export async function fetchSocialPosts() {
  if (!supabase) return [];
  const { data } = await supabase.from('social_posts')
    .select('*, author:author_id(full_name), approvals:post_approvals(*, approver:approver_id(full_name))')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createSocialPost(post, approverIds) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('social_posts').insert({
    content: post.content,
    platforms: post.platforms || [],
    scheduled_date: post.scheduled_date || null,
    status: approverIds?.length ? 'pending_approval' : 'draft',
    author_id: currentUser.id,
    notes: post.notes || '',
  }).select().single();
  if (error) throw error;

  if (approverIds?.length) {
    const approvals = approverIds.map(uid => ({
      post_id: data.id, approver_id: uid,
    }));
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

export async function approvePost(approvalId, postId, approved, comment) {
  if (!supabase) return;
  await supabase.from('post_approvals').update({
    status: approved ? 'approved' : 'rejected',
    comment: comment || '',
    responded_at: new Date().toISOString(),
  }).eq('id', approvalId);

  const { data: approvals } = await supabase.from('post_approvals')
    .select('*').eq('post_id', postId);

  const allResponded = approvals?.every(a => a.status !== 'pending');
  const allApproved = approvals?.every(a => a.status === 'approved');

  if (allResponded) {
    const newStatus = allApproved ? 'approved' : 'rejected';
    await supabase.from('social_posts').update({ status: newStatus }).eq('id', postId);

    const { data: post } = await supabase.from('social_posts').select('author_id').eq('id', postId).single();
    if (post) {
      await sendNotification(post.author_id, 'approval_result',
        `Post ${allApproved ? 'approved' : 'rejected'}`,
        `Your post has been ${allApproved ? 'approved by all reviewers' : 'rejected'}`,
        'social-planner'
      );
    }
  }
}

export async function updatePostStatus(id, status) {
  if (!supabase) return;
  await supabase.from('social_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteSocialPost(id) {
  if (!supabase) return;
  await supabase.from('social_posts').delete().eq('id', id);
}
