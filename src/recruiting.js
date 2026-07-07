import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

// ── DB Functions ─────────────────────────────────────────────────────
export async function fetchDbPositions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('recruiting_positions').select('*').order('created_at', { ascending: false });
  if (error) { console.warn('fetchDbPositions', error); return []; }
  return data || [];
}

export async function createDbPosition(pos) {
  if (!supabase) throw new Error('DB not connected');
  const { data, error } = await supabase.from('recruiting_positions').insert({
    title: pos.title, type: pos.type || 'Full Time', location: pos.location || '',
    comp: pos.comp || '', status: pos.status || 'Active', priority: pos.priority || false,
    sector: pos.sector || '', drive_url: pos.drive_url || '', summary: pos.summary || '',
    about: pos.about || '', responsibilities: pos.responsibilities || [],
    requirements: pos.requirements || [], created_by: currentUser?.id,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDbPosition(id, updates) {
  if (!supabase) return;
  const { error } = await supabase.from('recruiting_positions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDbPosition(id) {
  if (!supabase) return;
  const { error } = await supabase.from('recruiting_positions').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchDbCandidates() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('recruiting_candidates').select('*').order('created_at', { ascending: false });
  if (error) { console.warn('fetchDbCandidates', error); return []; }
  return data || [];
}

export async function createDbCandidate(cand) {
  if (!supabase) throw new Error('DB not connected');
  const initials = cand.initials || cand.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const { data, error } = await supabase.from('recruiting_candidates').insert({
    position_id: cand.position_id || null, name: cand.name, initials,
    candidate_role: cand.current_role || cand.candidate_role || '', candidate_company: cand.current_company || cand.candidate_company || '',
    location: cand.location || '', email: cand.email || '', linkedin: cand.linkedin || '',
    status: cand.status || 'new', email_sent: cand.email_sent || false,
    summary: cand.summary || '', drive_url: cand.drive_url || '',
    tags: cand.tags || [], notes: cand.notes || '',
    current_salary: cand.current_salary || '', desired_salary: cand.desired_salary || '',
    created_by: currentUser?.id,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDbCandidate(id, updates) {
  if (!supabase) return;
  const { error } = await supabase.from('recruiting_candidates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDbCandidate(id) {
  if (!supabase) return;
  const { error } = await supabase.from('recruiting_candidates').delete().eq('id', id);
  if (error) throw error;
}

// ── Static Seed Positions ─────────────────────────────────────────────
export const positions = [
  {
    id: 'dir-sales',
    title: 'Director of Sales',
    fullTitle: 'Director of US Sales',
    type: 'Full Time',
    location: 'Remote — US Based',
    comp: '$100,000–$130,000 base + uncapped commission + equity',
    status: 'Active',
    priority: true,
    sector: 'Healthcare',
    driveUrl: 'https://drive.google.com/drive/folders/1N2wAbvOJpHaAVYYVQzXRtWI47EAv4_WP',
    summary: 'Lead and grow US sales into hospitals, health systems, and IDNs for a physician-led virtual healthcare company. Player-coach role with end-to-end ownership of US commercial motion, reporting to CEO. Strong performance leads to VP of Sales within 18–24 months.',
    about: 'Confidential Search — Physician-led virtual healthcare company delivering connected care to US hospitals, health systems, and integrated delivery networks. Service lines span stroke, heart failure, kidney disease, behavioral health, and prevention. Growing rapidly, scaling US commercial operations.',
    responsibilities: [
      'Define US commercial strategy across hospitals, health systems, and IDNs',
      'Personally drive outbound prospecting on top strategic accounts',
      'Qualify opportunities and orchestrate physician meetings with US hospital decision-makers',
      'Direct lead generation strategy — outbound, conferences, channel partnerships, inbound',
      'Own CRM strategy (HubSpot or Salesforce) and team adoption',
      'Build sales playbook, qualification frameworks, and proposal templates',
      'Hire, ramp, and manage US-based AEs and SDRs as revenue scales',
      'Represent the company at major US industry conferences',
    ],
    requirements: [
      '5–10 years US healthcare sales with documented track record selling into US hospitals/health systems',
      'Personal track record of closing US health system contracts at $200K+ ACV',
      'Hunter mentality combined with builder mindset',
      'Established relationships with US health system buyers (CMO, VPMA, CMIO, CFO)',
      'Experience working with offshore or distributed operational teams is a plus',
      'Must be authorized to work in the United States without sponsorship',
    ],
    openedDate: '2026-06-02',
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    fullTitle: 'AI Engineer',
    type: 'Full Time',
    location: 'Remote — Global',
    comp: '$90,000–$140,000 / year + equity',
    status: 'Active',
    priority: true,
    sector: 'Engineering',
    driveUrl: 'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb',
    summary: 'Ship LLM systems for AvantStay — a $200M+ raised, $250M+ ARR vacation rental platform with 2,700+ properties. Strong individual contributor working directly with stakeholders on production AI agents (lead qualification, BI reporting, CX, infrastructure monitoring).',
    about: 'AvantStay runs the technology platform behind 2,700+ vacation rentals across 60+ destinations. $200M+ capital raised, $250M+ ARR, ~30 engineers. Recently shipped multiple production AI agents. Stack: Scala, TypeScript, PostgreSQL, ClickHouse, Kafka, Kubernetes on AWS. AI stack: Claude, OpenAI, LangGraph, MCP servers.',
    responsibilities: [
      'Ship LLM systems that tightly integrate with infrastructure and knowledge bases: PostgreSQL, ClickHouse, Kafka, APIs, MCPs',
      'Maintain autonomous and human-in-the-loop systems and ensure uptime and accuracy',
      'Interact with users and stakeholders to understand problems and design solutions',
      'Stay up-to-date with latest trends in LLMs and applied AI practices',
      'Update existing systems to be agent-accessible',
      'Build patterns and tooling that let the rest of engineering deploy agents faster',
    ],
    requirements: [
      'Shipped at least one LLM-powered system used by real users that took actions in a real system',
      'Can talk specifically about evals, retrieval shape, observability of agent traces, and handling non-determinism',
      'Strong software engineering fundamentals — databases, Kafka, GraphQL/REST, Kubernetes, AWS',
      'Proficient in TypeScript. Scala and Python a plus',
      'Product instincts — can sit with a stakeholder and walk out with a concrete idea of what to build',
      'Fluent in English',
    ],
    openedDate: '2026-06-02',
  },
  {
    id: 'project-owner',
    title: 'Project Owner',
    fullTitle: 'Project Owner — Operations, Growth & Partnerships',
    type: 'Full Time',
    location: 'Remote — US',
    comp: '$70,000–$100,000 base + 10–40% variable + stock options',
    status: 'Active',
    priority: false,
    sector: 'Healthcare',
    driveUrl: 'https://drive.google.com/drive/folders/1enJ-RXEL1yCj1SD9mwTYKNiYwaBbQXJJ',
    summary: 'Lead initiative to bring affordable healthcare to self-pay users, visitors, and small businesses across the country. Own the healthcare broker channel, affinity partnerships, and member acquisition for a physician-led healthcare technology company.',
    about: 'Physician-led healthcare technology company building a transparent, affordable membership platform giving people real access to primary care, labs, imaging, specialty consults, and prescriptions at fair prices. Supply infrastructure, technology, and clinical network are in place. Now scaling to bring it to those who need it most.',
    responsibilities: [
      'Build the healthcare broker channel — relationships with producing brokers and general agencies',
      'Develop affinity and community partnerships — associations, credit unions, religious organizations',
      'Own member acquisition and retention initiatives',
      'Pipeline, reporting, partner success, and operational rhythm',
      'Grow national network of brokers offering affordable healthcare to their clients',
    ],
    requirements: [
      '4–7 years in healthcare BD, partnerships, or sales — ideally selling to or through brokers, employers, or affinity organizations',
      'Direct experience in the healthcare broker market strongly valued',
      'Track record of building channel partnerships from scratch and scaling them',
      'Strong communication skills and ability to represent a mission-driven product',
      'Self-directed in a remote work environment',
      'Care about the mission — healthcare access, not just a market opportunity',
    ],
    openedDate: '2026-06-02',
  },
  {
    id: 'practice-admin',
    title: 'Practice Administrator',
    fullTitle: 'Practice Administrator — Post-Acute & Multi-Specialty Hybrid',
    type: 'Full Time',
    location: 'Jacksonville, Orlando, or adjacent FL (with regional travel)',
    comp: '$100,000–$130,000 base + up to 20% performance bonus + equity',
    status: 'Active',
    priority: false,
    sector: 'Healthcare',
    driveUrl: 'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ',
    summary: 'Lead and scale post-acute, virtual, and home-based care lines for a growing physician-led multi-specialty group across North and Central Florida. Hands-on practice operations role — not strategy. Own three connected lines: on-site specialty practice, virtual specialty care expansion, and CMS GUIDE dementia program launch.',
    about: 'Growing physician-led multi-specialty group. Hiring a Practice Administrator to lead and scale its post-acute, virtual, and home-based care lines across North and Central Florida. The nursing home and ALF footprint is the gate opener and platform for everything else.',
    responsibilities: [
      'Run day-to-day operations of on-site specialty practice across nursing home and ALF network',
      'Build and scale virtual specialty care — virtual consults inside SNF/ALF facilities and home-based virtual visits',
      'Operationalize the CMS GUIDE program: care navigator workflows, caregiver engagement, respite coordination',
      'Lead clinical operations: scheduling, documentation, patient flow, workflow design',
      'Own P&L: census, revenue per patient, margin, and facility activation velocity',
      'Recruit and lead the team — NPs, care navigators, on-site coordinators, and admin staff',
      'Ensure clean documentation, accurate billing, and physician credentialing',
    ],
    requirements: [
      'Have personally run or managed a private medical practice as administrator or manager (required)',
      'Fluent in clinical operations: physician workflows, coding, billing, credentialing, Medicare compliance',
      'Builder who has launched and scaled a service line, not just maintained one',
      '7+ years in healthcare operations',
      'Experience in SNF, ALF, memory care, post-acute, or home-based care strongly preferred',
      'Based in or willing to work from Jacksonville, Orlando, or adjacent FL; valid FL driver\'s license',
    ],
    openedDate: '2026-06-02',
  },
  {
    id: 'manage-engine',
    title: 'Manage Engine / IT Engineer',
    fullTitle: 'IT Infrastructure & Systems Engineer (ManageEngine)',
    type: 'Full Time',
    location: 'Remote / Hybrid',
    comp: 'TBD',
    status: 'Active',
    priority: false,
    sector: 'IT',
    driveUrl: 'https://drive.google.com/drive/folders/1BwwEPpeMyuhMzULyI5IRukoMhVq30Rt8',
    summary: 'IT infrastructure and systems support role with ManageEngine expertise. Supporting enterprise IT operations, endpoint management, monitoring, and security across client environments.',
    about: 'IT Impact Consulting internal/client-facing IT engineering role focused on ManageEngine platform deployment, endpoint management, monitoring infrastructure, and L1/L2/L3 support.',
    responsibilities: [
      'Deploy and manage ManageEngine suite (Desktop Central, ServiceDesk Plus, OpManager)',
      'Windows/Linux server administration and endpoint management',
      'Monitoring infrastructure: Grafana, Prometheus, Zabbix, Nagios',
      'Patch management, vulnerability assessment, and remediation',
      'Active Directory administration and identity management',
      'L2/L3 technical support and incident management (ITIL)',
    ],
    requirements: [
      'ManageEngine experience (Desktop Central / Endpoint Central)',
      'Linux (RHEL/CentOS/Ubuntu) and Windows Server administration',
      'Monitoring tools: Grafana, Prometheus, Nagios, SolarWinds',
      'Cloud & virtualization: AWS, Azure, VMware',
      'ITIL incident/problem management',
      'Scripting: Bash, PowerShell, Ansible',
    ],
    openedDate: '2026-01-22',
  },
];

// ── Candidates ────────────────────────────────────────────────────────
export const candidates = [
  // Director of Sales
  { id:'c1', positionId:'dir-sales', name:'Azis R. Dabas', initials:'AD', currentRole:'VP/Director, Provider Network & Payer Growth', currentCompany:'Doral Health & Wellness (PE-backed)', location:'New York, NY', email:'azis.rafael@gmail.com', linkedin:'linkedin.com/in/azis-dabas', status:'shortlisted', emailSent:true, summary:'Healthcare growth exec, 10+ yrs. $170M+ mapped across leakage, LTV, ARR. Built commercial operating systems at PE-backed platforms. Onboarded 1,200+ clinicians in 90 days. Claims intelligence via Databricks. Strong ICP fit for health system sales.', driveUrl:'https://drive.google.com/file/d/1iWeS8jnIUKVaxAPkZLt8TkqbuP5nap4t/view', tags:['healthcare','PE-backed','revenue ops','network growth'], notes:'Shortlisted by Amish. Strong provider network experience. May be overqualified for pure sales role but worth a call.' },
  { id:'c2', positionId:'dir-sales', name:'Alfred Nunez', initials:'AN', currentRole:'Director of Sales', currentCompany:'INULTI', location:'Miami, FL', email:'anunez0283@yahoo.com', linkedin:'', status:'shortlisted', emailSent:true, summary:'Medicare sales executive, 20+ yrs. $1.6M annual revenue at INULTI. $861K in 7 months. Sold AgencyRunner SaaS CRM. Broker & agency growth leader. Licensed Health, Life & Annuities. Fluent English & Spanish.', driveUrl:'https://drive.google.com/file/d/1Xq0KiNwIxPX0HEORrUPpvfwCgjedXq-7/view', tags:['medicare','SaaS sales','broker','agency growth'], notes:'Shortlisted. Strong Medicare/broker channel experience. Good fit for health system outreach.' },
  { id:'c3', positionId:'dir-sales', name:'Aaron B. Durham', initials:'AD', currentRole:'Senior Director, Retail Sales', currentCompany:'Verizon', location:'Raleigh, NC', email:'aarondurham798@gmail.com', linkedin:'linkedin.com/in/aarondurham798', status:'reviewing', emailSent:false, summary:'15 years at Verizon. Led $500M+ multi-channel market (30+ locations, 400+ employees). #1 Atlantic South ranking, Top 8 nationally. Strong P&L management and enterprise sales. Not healthcare-specific — would need sector onboarding.', driveUrl:'https://drive.google.com/file/d/1mhNScAeIGtq4tHTxwGo1RaJr1TFLjyNe/view', tags:['enterprise sales','P&L','multi-site','retail'], notes:'Strong sales leadership but no healthcare background. Consider if healthcare-native pipeline dries up.' },
  { id:'c4', positionId:'dir-sales', name:'Lauren Kalafa', initials:'LK', currentRole:'Account Executive', currentCompany:'Informa', location:'Boca Raton, FL', email:'Lkalafa1@gmail.com', linkedin:'linkedin.com/in/lauren-kalafa-4b024616', status:'reviewing', emailSent:false, summary:'$1M+ FY1 revenue, top 2 performer company-wide. 130% YoY attainment. Managed ~2,000 key accounts. B2B sales, medical conferences, pharma. Previous CAO at Seaport Global (investment bank & family office). Diverse background.', driveUrl:'https://drive.google.com/file/d/1GaRLjcUkRW-tnHN4Ua1GOgfDRzhZvdf6/view', tags:['B2B sales','medical','account management'], notes:'' },
  { id:'c5', positionId:'dir-sales', name:'Mark Do Couto', initials:'MC', currentRole:'Regional VP of Sales', currentCompany:'Service Express', location:'Dallas, TX', email:'mark.docouto@gmail.com', linkedin:'linkedin.com/in/markdocouto', status:'new', emailSent:false, summary:'15+ yrs enterprise sales. Scaled ARR $40M→$140M (3.5x) at Altair Engineering. Led 100+ person global sales org across 27 countries. SVP Data Analytics Sales. Strong M&A integration experience. Not healthcare-specific.', driveUrl:'https://drive.google.com/file/d/1NRPEJk9IxdWQTTTHNF_0mCDfH8rVaIoC/view', tags:['enterprise sales','ARR growth','data analytics','global'], notes:'' },
  { id:'c6', positionId:'dir-sales', name:'Michael Vorsanger', initials:'MV', currentRole:'Co-Founder, AI Strategy & Incubation', currentCompany:'Nootan Labs AI', location:'Palm Beach, FL', email:'mvorsanger@gmail.com', linkedin:'linkedin.com/in/michaelvorsanger', status:'new', emailSent:false, summary:'AI strategy & transformation leader. Fractional Chief AI Officer. Claude Code Certified. Built $20M+ ARR pipeline at Picnic Works. Served as Interim CEO. Enterprise SaaS sales at SevenRooms, NCR, MGM. Interesting AI angle but hospitality-focused.', driveUrl:'https://drive.google.com/file/d/18mVZzxFoy2KBxUFN6cFZJeZdVzHD3-RO/view', tags:['AI strategy','fractional CIO','SaaS sales','hospitality'], notes:'Interesting AI-first sales profile. Strong for AI product sales roles. Less fit for health system sales.' },

  // AI Engineer
  { id:'c7', positionId:'ai-engineer', name:'Aneeq Khatri', initials:'AK', currentRole:'AI Engineer (Agentic AI)', currentCompany:'Voya AI (US)', location:'Karachi, Pakistan', email:'aneeqabdulsamad5761@gmail.com', linkedin:'linkedin.com/in/aneeq-khatri', status:'shortlisted', emailSent:true, summary:'4 yrs production engineering, 2 yrs autonomous multi-agent systems. LangGraph, LangChain, CrewAI, OpenAI Agent SDK. Currently at Voya AI (US). Trained 3,000+ engineers via PIAIC/GIAIC Pakistan. Deep tool-calling, MCP integrations, agent evaluation expertise.', driveUrl:'https://drive.google.com/file/d/10sM8sZeyxEkuacHBryNPPk5IEZkTiPFi/view', tags:['multi-agent','LangGraph','MCP','production AI'], notes:'Strong match — production agentic AI, US client experience, MCP expertise. Top candidate.' },
  { id:'c8', positionId:'ai-engineer', name:'Umair Afzal', initials:'UA', currentRole:'AI and MLOps Engineer', currentCompany:'Betterdata', location:'Islamabad, Pakistan', email:'umairafzal92786@gmail.com', linkedin:'linkedin.com/in/umairafzal92786', status:'shortlisted', emailSent:true, summary:'3+ yrs LLM systems, RAG pipelines, voice agents. Led 15-member cross-functional team. Promoted to Lead AI Engineer at QLU.AI/DNNae. vLLM, LangChain, LlamaIndex. Published researcher (FracTS time-series generation). FAST NUCES Dean\'s Honor List.', driveUrl:'https://drive.google.com/file/d/1v2pcF3updDZ9fC9z-A772yjxb5lkl0wB/view', tags:['LLM','RAG','voice agents','MLOps','team lead'], notes:'Strong technical profile + leadership experience. Recruitment automation background at QLU.AI is interesting.' },
  { id:'c9', positionId:'ai-engineer', name:'Mohsin Shahid', initials:'MS', currentRole:'AI Engineer', currentCompany:'Eye4Tech', location:'Lahore, Pakistan', email:'mohsinshahid052@gmail.com', linkedin:'linkedin.com/in/mohsinshahid052', status:'shortlisted', emailSent:true, summary:'3+ yrs AI/ML, RAG systems, LLM fine-tuning, multi-agent automation, conversational AI. Healthcare chatbot (HumanOp), e-commerce AR/CV chatbot (Seiko), AgentBest.ai multi-agent platform. OpenClaw.ai email automation.', driveUrl:'https://drive.google.com/file/d/1f0ngMO5pIJVK1Tg3EiM2yq3SrH6pAVnE/view', tags:['RAG','LLM fine-tuning','healthcare AI','multi-agent'], notes:'Solid production AI background. Healthcare AI experience with HumanOp is a plus.' },
  { id:'c10', positionId:'ai-engineer', name:'Duaa Fatima', initials:'DF', currentRole:'AI Engineer', currentCompany:'Indexy (indexyai)', location:'Islamabad, Pakistan', email:'fatimaduaa053@gmail.com', linkedin:'linkedin.com/in/duaa-fatima', status:'reviewing', emailSent:true, summary:'FAST University BS Data Science, Dean\'s List. RAG pipelines, LangChain, Pinecone, Claude API. UAV swarm agentic AI research at NCRA (88.2% task completion). Fine-tuned Mistral-7B. WhatsApp agentic scheduler. Strong academics + applied work.', driveUrl:'https://drive.google.com/file/d/1mqimoGcy49hXbkC8ekmI53AP2sB2hLio/view', tags:['RAG','Claude API','agentic AI','research'], notes:'Strong academic profile, applied research experience. Less production experience than top candidates.' },
  { id:'c11', positionId:'ai-engineer', name:'Syeda Ayesha', initials:'SA', currentRole:'Data Scientist', currentCompany:'BEC Legal Systems (Jonas Software)', location:'Karachi, Pakistan', email:'syedaayesha547@gmail.com', linkedin:'', status:'reviewing', emailSent:false, summary:'MS Data Science, IBA. Deployed AI in production at legal tech company. Schedule Assist (Azure Container Services), 85% manual effort reduction. 98% accurate document classifier. Integrated CoreRelate APIs via MCP server. GPT models for structured data extraction.', driveUrl:'https://drive.google.com/file/d/10qLtGQFsZVTKhSAoZS9DcaBRMK09PGAe/view', tags:['data science','MCP','Azure','production AI','legal tech'], notes:'Strong production AI deployment. MCP server integration experience is relevant to the role.' },
  { id:'c12', positionId:'ai-engineer', name:'Muhammad Sarmad Saleem', initials:'SS', currentRole:'Research Assistant', currentCompany:'NUST MVIS Lab', location:'Lahore, Pakistan', email:'sarmadsaleem.333@gmail.com', linkedin:'linkedin.com/in/muhammad-sarmad-saleem-3bb060266', status:'reviewing', emailSent:false, summary:'NUST CS, CGPA 3.41. DAAD fully-funded research intern at RPTU Germany. LangChain, LangGraph, MCP Servers, FAISS, Pinecone. Built job recommendation and resume parsing systems. Strong academic, earlier in career.', driveUrl:'https://drive.google.com/file/d/1lDVlU1e0KcvP0l--LIq7L86Bxq7jGa3D/view', tags:['LangChain','LangGraph','MCP','research','NUST'], notes:'Strong academic and research profile. Less production experience — better for junior/graduate hire.' },
  { id:'c13', positionId:'ai-engineer', name:'Nirwa Tul Yusra', initials:'NY', currentRole:'Associate AI Engineer', currentCompany:'Developers Den LLC', location:'Islamabad, Pakistan', email:'nirwatulyusra15@gmail.com', linkedin:'linkedin.com/in/nirwa-tul-yusra', status:'new', emailSent:false, summary:'Masters AI at NUST. FastAPI, LangChain, RAG pipelines, ChromaDB, Pinecone, Azure. Fine-tuned TTS models on RunPod GPU. Gmail API + Microsoft Graph API integrations. Twilio, ElevenLabs, Deepgram. 1+ yr experience.', driveUrl:'https://drive.google.com/file/d/15VoG_LsCb6-LjgslFSSJ9fp-8nYndkEC/view', tags:['FastAPI','LangChain','Azure','TTS','voice AI'], notes:'Early career but strong technical breadth. Voice AI experience is differentiating.' },

  // Practice Administrator
  { id:'c14', positionId:'practice-admin', name:'Cindy Dimsey', initials:'CD', currentRole:'Chief Administrative Officer', currentCompany:'Advanced Urology Institute (2022–2025)', location:'Port Orange, FL', email:'dimsey.cindy@gmail.com', linkedin:'', status:'shortlisted', emailSent:true, summary:'Enterprise healthcare ops exec. $63.5M operating scope, $10.1M margin expansion. Multi-state operations, 100+ workforce. Lean Six Sigma Black Belt. Standardized 8 locations. CAO at multi-site urology surgical platform.', driveUrl:'https://drive.google.com/file/d/1d8P2e1nB-c2P3WV1tyFOuAn4SZtlcrw5/view', tags:['healthcare ops','multi-state','P&L','Six Sigma','CAO'], notes:'Strong shortlist candidate. Multi-site healthcare ops at the right scale. FL-based.' },
  { id:'c15', positionId:'practice-admin', name:'Daniela Trivino', initials:'DT', currentRole:'Operations Manager', currentCompany:'Everslim — Multisite Medical Practice', location:'Tampa, FL', email:'hello@daniopsgroup.com', linkedin:'linkedin.com/in/daniopsgroup', status:'shortlisted', emailSent:true, summary:'Healthcare operations leader, 8+ yrs. Functional medicine, integrative practices, acute care. P&L ownership, KPI dashboards, revenue growth. Currently nursing preceptorship at Tampa General (Level 1 Trauma). Bilingual English/Spanish. Epic, Athenahealth, eClinicalWorks.', driveUrl:'https://drive.google.com/file/d/1uam2MnQeJbjnBmmJazjVsE4l71-XXFMg/view', tags:['healthcare ops','P&L','KPI','EMR','bilingual'], notes:'Shortlisted. Strong operations + clinical background. Tampa-based, open to travel.' },
  { id:'c16', positionId:'practice-admin', name:'Donald S. Gilcrist', initials:'DG', currentRole:'Sr. Regional Director, Healthcare Operations', currentCompany:'Optum/WellMed', location:'Jacksonville, FL', email:'avidondg@comcast.net', linkedin:'linkedin.com/in/donaldgilcrist86', status:'shortlisted', emailSent:true, summary:'15+ yrs healthcare executive. $168M+ revenue portfolio, 16 counties, 30+ facilities. +23% HCC performance, +18% STAR quality increase. RN + MBA. Value-based care, Medicare Advantage, HEDIS. Strong FL-based regional director profile.', driveUrl:'https://drive.google.com/file/d/11Q3GKq_M_hmLe0eGxbdbWKGPcKvIYfSD/view', tags:['healthcare ops','Medicare','value-based care','RN','MBA'], notes:'Shortlisted. Jacksonville-based, strong clinical + operations hybrid. Medicare experience valuable.' },
  { id:'c17', positionId:'practice-admin', name:'Kyaundrea Epps', initials:'KE', currentRole:'Clinical Operations Manager', currentCompany:'AGAPE Family Health, Jacksonville FL', location:'Jacksonville, FL', email:'kstunna2006@gmail.com', linkedin:'linkedin.com/in/kyaundrea-epps', status:'reviewing', emailSent:false, summary:'Healthcare ops professional. Manages clinical operations for primary care, pediatrics, behavioral health, podiatry, OBGYN. Previously Assistant Center Admin at Walmart Health (4 multi-site centers, 3 service lines). PACE Partners Finance Manager. Jacksonville-based.', driveUrl:'https://drive.google.com/file/d/1i0e71YKnVYwNPlpaqay9pWC3AjO6rlEB/view', tags:['clinical ops','multi-site','Jacksonville','primary care'], notes:'Good Jacksonville-based candidate. Less P&L experience than shortlisted candidates.' },
  { id:'c18', positionId:'practice-admin', name:'Robert Gray III', initials:'RG', currentRole:'Project Manager / Operations Manager', currentCompany:'University of Maryland Medical System', location:'Lake City, FL', email:'roberthgray@gmail.com', linkedin:'', status:'reviewing', emailSent:false, summary:'Healthcare IT and operations leader. Kronos and B4 Health implementations for 1,000+ employees across 13 orgs. VP Implementations at Continuum Health. Strong data migration, workforce analytics, EMR/EHR integration. Healthcare IT consulting background.', driveUrl:'https://drive.google.com/file/d/1ySR6VW64Sty4bGATYN0tA8k_CA2HQWIP/view', tags:['healthcare IT','EMR','workforce analytics','implementation'], notes:'Strong healthcare IT profile but more tech/project management than clinical operations.' },
  { id:'c19', positionId:'practice-admin', name:'Sonja M.', initials:'SM', currentRole:'Area/Practice Manager', currentCompany:'InFocus Eyecare, Jacksonville FL', location:'Jacksonville, FL', email:'Sonja.m.ingram@gmail.com', linkedin:'', status:'new', emailSent:false, summary:'15+ yrs multi-unit operations. Healthcare, retail, service environments. $2M–$4M+ revenue locations. President\'s Club 2x. Multi-site optometry practice management. Revenue turnaround specialist.', driveUrl:'https://drive.google.com/file/d/1LV6pTd4T9ZSszOsav1Sqm0AbYyaNQqSq/view', tags:['multi-unit ops','optometry','Jacksonville','revenue growth'], notes:'' },

  // Manage Engine
  { id:'c20', positionId:'manage-engine', name:'Syed Zeeshan Haider', initials:'SZ', currentRole:'System Support Engineer', currentCompany:'Seamless Distribution System AB', location:'Riyadh, Saudi Arabia', email:'syedzeeshanhaider9708@gmail.com', linkedin:'linkedin.com/in/syed-zeeshan-haider-61689915b', status:'reviewing', emailSent:false, summary:'6+ yrs IT infrastructure, Linux/Windows admin, NOC operations, L1/L2 support. ManageEngine Desktop Central, PDQ Deploy. Telecom clients: Zain KSA, STC, MTN, Orange. Prometheus, Grafana, Nagios, Zabbix. ITIL, Active Directory, Azure Entra ID.', driveUrl:'https://drive.google.com/file/d/1hYYEkhPNU8q-ek-O-2JGjTE-bst7kj3x/view', tags:['ManageEngine','Linux','NOC','monitoring','ITIL'], notes:'Strong ManageEngine and monitoring background. Currently in KSA — check open to remote/relocation.' },
  { id:'c21', positionId:'manage-engine', name:'M Kashif Khan', initials:'MK', currentRole:'IT Infrastructure Architect / Cloud Security', currentCompany:'(Consulting)', location:'(Pakistan/International)', email:'tokashifkhan@gmail.com', linkedin:'', status:'reviewing', emailSent:false, summary:'CISM + PMP certified. Azure, AWS, VMware, Nutanix. Designed IT/OT hybrid architectures. Collaborated on Aramco MetaBrain AI project. SCADA Micro Data Centers, SD-WAN, NetApp AFF/ONTAP. Security frameworks: ISO 27001, NIST, GDPR, HIPAA. Palo Alto, Cisco ISE, Splunk.', driveUrl:'https://drive.google.com/file/d/1SPJo30KY0Sa46YjfKpaD-4-bQgwFiRNl/view', tags:['cloud architect','CISM','PMP','Azure','security','ManageEngine'], notes:'Senior/architect level — may be overqualified. Strong credentials.' },

  // AI Engineer — additional CVs
  { id:'c22', positionId:'ai-engineer', name:'Ahmad Shayan', initials:'AS', currentRole:'Data Scientist / ML Engineer', currentCompany:'(Open to opportunities)', location:'Lahore, Pakistan', email:'ahmedshayan1112@gmail.com', linkedin:'linkedin.com/in/ahmedshayan', status:'new', emailSent:false, summary:'Data Scientist, ML enthusiast, Python & R expert. Backend development, deep learning models, data pipelines. Strong Python/R technical foundation.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['data science','ML','Python','R'], notes:'' },
  { id:'c23', positionId:'ai-engineer', name:'Talha Shakeel', initials:'TS', currentRole:'AI Systems Engineer', currentCompany:'(International Clients)', location:'Pakistan', email:'imtalha.shakeel@gmail.com', linkedin:'linkedin.com/in/iztalha', status:'new', emailSent:false, summary:'3+ yrs building AI systems for international clients. Production AI engineering background. Strong client-facing experience. Technical stack includes LLM integrations and AI system deployment.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['AI systems','production AI','international clients'], notes:'' },
  { id:'c24', positionId:'ai-engineer', name:'Abu Hurrairah', initials:'AH', currentRole:'AI Engineer / ML Engineer', currentCompany:'(Open to opportunities)', location:'Pakistan / Malaysia', email:'abuhurrairah1234@gmail.com', linkedin:'linkedin.com/in/abu-hurrairah', status:'new', emailSent:false, summary:'AI Engineer with ML and software engineering background. Multi-country experience (Pakistan/Malaysia). AI/ML production deployment and software engineering skills.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['AI engineer','ML','software engineering'], notes:'' },
  { id:'c25', positionId:'ai-engineer', name:'Sohaib Touseef', initials:'ST', currentRole:'Full Stack AI Developer', currentCompany:'(Open to opportunities)', location:'Karachi, Pakistan', email:'muhammadsohaib2233344@gmail.com', linkedin:'linkedin.com/in/muhammadsohaib', status:'new', emailSent:false, summary:'Full Stack AI Developer with hands-on experience building AI-integrated web applications. Python, React, AI integrations. Full-stack background with AI overlay.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['full stack AI','Python','React','AI integrations'], notes:'' },
  { id:'c26', positionId:'ai-engineer', name:'Areeba Bahadur', initials:'AB', currentRole:'CS Student / Junior AI Engineer', currentCompany:'FAST-NUCES', location:'Pakistan', email:'areeba.bahadur.00@gmail.com', linkedin:'linkedin.com/in/areeba-bahadur-915aa236b', status:'new', emailSent:false, summary:'FAST-NUCES BSCS student. Early-career AI/ML background. Strong academic foundation in computer science.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['junior','FAST-NUCES','AI/ML','student'], notes:'Early career / student profile.' },
  { id:'c27', positionId:'ai-engineer', name:'M. Ishtiaq Azfar', initials:'IA', currentRole:'Final-Year EE Student', currentCompany:'FAST-NUCES Islamabad', location:'Islamabad, Pakistan', email:'ishtiaqazfar@gmail.com', linkedin:'linkedin.com/in/muhammad-ishtiaq-azfar', status:'new', emailSent:false, summary:'Final-year Electrical Engineering student at FAST-NUCES. AI/ML track. Strong academic profile. Early-career candidate with engineering fundamentals.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['student','EE','FAST-NUCES','AI/ML'], notes:'Final-year student — junior/intern level.' },
  { id:'c28', positionId:'ai-engineer', name:'Ibrahim Khan', initials:'IK', currentRole:'Senior Software Engineer — AI Automation', currentCompany:'(Open to opportunities)', location:'Pakistan', email:'khan.ibrahim.2251@gmail.com', linkedin:'linkedin.com/in/khan-ibrahim2251', status:'new', emailSent:false, summary:'Senior Software Engineer specializing in AI automation architecture, workflow optimization, and AI systems. Strong automation and AI integration background.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['senior','AI automation','workflow','systems'], notes:'' },
  { id:'c29', positionId:'ai-engineer', name:'Muhammad Tariq', initials:'MT', currentRole:'Senior Full Stack Engineer', currentCompany:'(Open to opportunities)', location:'Pakistan', email:'', linkedin:'', status:'new', emailSent:false, summary:'Senior Full Stack Engineer. Python, Django, Flask, FastAPI, React.js, Node.js, PostgreSQL, Docker. Strong backend Python with AI framework familiarity (FastAPI). Full-stack with AI-ready stack.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['full stack','Python','FastAPI','Django','Docker'], notes:'' },
  { id:'c30', positionId:'ai-engineer', name:'Syed Mohsin Hussain Shah', initials:'SM', currentRole:'AI Engineer', currentCompany:'(Open to opportunities)', location:'Lahore, Pakistan', email:'mohsinshah1230@gmail.com', linkedin:'', status:'new', emailSent:false, summary:'AI Engineer with deep learning model development and training expertise. Optimized accuracy and performance metrics. Production AI/ML background.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['AI engineer','deep learning','model training'], notes:'' },
  { id:'c31', positionId:'ai-engineer', name:'Salman Raza', initials:'SR', currentRole:'Senior Full Stack Developer', currentCompany:'(Open to opportunities)', location:'Pakistan', email:'coderdev304@gmail.com', linkedin:'linkedin.com/in/salman-raza-9a7a92194', status:'new', emailSent:false, summary:'Senior Full Stack Developer with Python/React/Node.js. Frontend-heavy full stack profile with strong Python backend. AI integration capabilities.', driveUrl:'https://drive.google.com/drive/folders/1i08vmRcKD3t1AqwiUlTj1rf5nd9xYANb', tags:['full stack','Python','React','Node.js'], notes:'' },

  // Practice Administrator — additional CVs
  { id:'c32', positionId:'practice-admin', name:'Ayessa Toler', initials:'AT', currentRole:'FACHE — Healthcare Executive', currentCompany:'(Transitioning / Relocating to Jacksonville FL)', location:'Relocating to Jacksonville, FL', email:'ayessa.toler@gmail.com', linkedin:'linkedin.com/in/ayessa-toler', status:'new', emailSent:false, summary:'Fellow of the American College of Healthcare Executives (FACHE). Transitioning military healthcare executive relocating to Jacksonville FL. Strong executive healthcare leadership background.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['FACHE','executive','military health','Jacksonville','relocating'], notes:'FACHE credential is strong. Military healthcare ops = excellent compliance + process discipline.' },
  { id:'c33', positionId:'practice-admin', name:'Jeremy Nellis', initials:'JN', currentRole:'Healthcare Operations Leader', currentCompany:'(Nashville TN)', location:'Nashville, TN', email:'jeremytnellis@gmail.com', linkedin:'linkedin.com/in/jeremy-nellis', status:'new', emailSent:false, summary:'Results-driven healthcare leader with experience in hospital operations and joint venture development. Strong operational background. Nashville-based — would require relocation to FL.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['hospital ops','joint venture','healthcare leader'], notes:'Nashville-based. Check if open to FL relocation.' },
  { id:'c34', positionId:'practice-admin', name:'Ashley Wolfinbarger', initials:'AW', currentRole:'Project Manager / Healthcare Operations Leader', currentCompany:'(Burlington KY — relocating to FL)', location:'Burlington, KY → relocating to FL', email:'Ashleys@email.com', linkedin:'', status:'new', emailSent:false, summary:'PMP certified. Program & operations management. Healthcare operations leadership background. Actively relocating to Florida and open to remote roles. Organized, process-driven PM profile.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['PMP','healthcare ops','project management','relocating to FL'], notes:'PMP + relocating to FL = good practical fit.' },
  { id:'c35', positionId:'practice-admin', name:'Dr. Mark Gerges', initials:'MG', currentRole:'Healthcare Executive / Medical Affairs', currentCompany:'(Jacksonville Beach FL)', location:'Jacksonville Beach, FL', email:'Mark.Gerges@gmail.com', linkedin:'', status:'new', emailSent:false, summary:'MD + Healthcare Executive with medical affairs and operations leadership. Jacksonville Beach FL-based. Rare clinical + executive hybrid. Strong physician-facing credibility.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['MD','medical affairs','executive','Jacksonville'], notes:'MD credential = can speak physician language. Potentially overqualified but strong FL fit.' },
  { id:'c36', positionId:'practice-admin', name:'Karla King', initials:'KK', currentRole:'Healthcare Operations Manager', currentCompany:'(Tallahassee FL)', location:'Tallahassee, FL', email:'Karla_s_king@yahoo.com', linkedin:'linkedin.com/in/karlasking', status:'new', emailSent:false, summary:'Healthcare Operations Manager with compliance and regulatory strategy expertise. Program development background. Tallahassee FL-based. Strong compliance and ops combination.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['healthcare ops','compliance','regulatory','Tallahassee'], notes:'' },
  { id:'c37', positionId:'practice-admin', name:'Mykyla Hooper', initials:'MH2', currentRole:'Health Science Graduate', currentCompany:'Florida A&M University', location:'Tallahassee, FL', email:'mykylahooper@gmail.com', linkedin:'', status:'new', emailSent:false, summary:'BS Health Science from Florida A&M University, completed August 2025. Early-career FL-based health science professional. Recent graduate — suitable for coordinator/junior admin role.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['entry level','health science','Florida','recent grad'], notes:'Recent grad — early career. Better fit for coordinator level than Administrator.' },
  { id:'c38', positionId:'practice-admin', name:'Laurica Yoakum', initials:'LY', currentRole:'Clinical & Administrative Professional', currentCompany:'(O\'Fallon MO)', location:'O\'Fallon, MO', email:'klasssiladie@gmail.com', linkedin:'', status:'new', emailSent:false, summary:'20+ years clinical and administrative experience. Results-driven healthcare professional. Missouri-based — would require relocation. Long track record in clinical ops management.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['clinical ops','20+ yrs','administration'], notes:'Strong experience but Missouri-based. Check FL interest.' },
  { id:'c39', positionId:'practice-admin', name:'Jisselle Beton', initials:'JB', currentRole:'Healthcare Operations Professional', currentCompany:'(Open to opportunities)', location:'United States', email:'', linkedin:'', status:'new', emailSent:false, summary:'Healthcare professional with expertise in patient care, coordination, and clinical operations management. Improved patient outcomes. Clinical operations and coordination background.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['clinical ops','patient care','coordination'], notes:'' },
  { id:'c40', positionId:'practice-admin', name:'Carole Sraver', initials:'CS', currentRole:'Director of Patient Access / Communications', currentCompany:'Prime Healthcare', location:'Valrico, FL', email:'csraver@hotmail.com', linkedin:'', status:'new', emailSent:false, summary:'Director of Patient Access and Communications at Prime Healthcare (March 2023–Present). Valrico FL-based. Strong patient access, revenue cycle, and communications leadership. FL-based senior professional.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['patient access','director','revenue cycle','Florida'], notes:'FL-based Director level. Strong patient access ops experience.' },
  { id:'c41', positionId:'practice-admin', name:'Kieran Cottrill', initials:'KC', currentRole:'Healthcare Operations Professional', currentCompany:'(St. Augustine FL)', location:'St. Augustine, FL', email:'kieran.cottrill@gmail.com', linkedin:'linkedin.com/in/kieran-cottrill-09b8b4112', status:'new', emailSent:false, summary:'Healthcare operations professional based in St. Augustine, FL. FL-based candidate open to North FL region — close to Jacksonville/Orlando target area.', driveUrl:'https://drive.google.com/drive/folders/1gq7e7PylWR5FPMVe1_G14QFw23-yWkcZ', tags:['healthcare ops','St. Augustine FL','North FL'], notes:'St. Augustine FL — ideal location for the North/Central FL role.' },
];

// ── Candidate status config ───────────────────────────────────────────
export const CANDIDATE_STATUSES = [
  { id:'new',          label:'New',           color:'#5a5a72' },
  { id:'reviewing',    label:'Reviewing',     color:'#6366f1' },
  { id:'email-sent',   label:'Email Sent',    color:'#818cf8' },
  { id:'shortlisted',  label:'Shortlisted',   color:'#10b981' },
  { id:'interviewing', label:'Interviewing',  color:'#f59e0b' },
  { id:'offered',      label:'Offered',       color:'#10b981' },
  { id:'rejected',     label:'Rejected',      color:'#ef4444' },
  { id:'on-hold',      label:'On Hold',       color:'#9090a8' },
];
