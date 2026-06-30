// ── Builds node/edge data for the relationship map from CRM state ──
export function buildGraph({ leads, projects, team, positions, candidates }) {
  const nodes = [];
  const edges = [];

  (leads || []).forEach(l => {
    nodes.push({ id: 'lead-' + l.id, type: 'lead', label: l.name, sub: l.company || '', color: '#f59e0b', size: 1 + Math.min((l.value || 0) / 50000, 2) });
    if (l.assigned_to) edges.push({ from: 'lead-' + l.id, to: 'team-' + l.assigned_to });
  });

  (projects || []).forEach(p => {
    nodes.push({ id: 'proj-' + p.id, type: 'project', label: p.name, sub: p.status || '', color: '#3b82f6', size: 1.4 });
    if (p.created_by) edges.push({ from: 'proj-' + p.id, to: 'team-' + p.created_by });
  });

  (team || []).forEach(t => {
    nodes.push({ id: 'team-' + t.id, type: 'team', label: t.full_name || t.email, sub: t.designation || t.role || '', color: '#a855f7', size: 1.3 });
  });

  (positions || []).forEach(pos => {
    nodes.push({ id: 'pos-' + pos.id, type: 'position', label: pos.title, sub: pos.sector || '', color: '#10b981', size: 1.2 });
  });

  (candidates || []).forEach(c => {
    nodes.push({ id: 'cand-' + c.id, type: 'candidate', label: c.name, sub: c.currentRole || '', color: '#ec4899', size: 1 });
    if (c.positionId) edges.push({ from: 'cand-' + c.id, to: 'pos-' + c.positionId });
  });

  return { nodes, edges };
}

export const NODE_TYPE_LABELS = {
  lead: 'Lead', project: 'Project', team: 'Team Member', position: 'Open Position', candidate: 'Candidate',
};
