// ── AI Agents — calls OpenAI or Anthropic directly using a user-supplied key ──
const KEY_STORAGE = 'itimpact_ai_key';
const PROVIDER_STORAGE = 'itimpact_ai_provider';

export function getApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function getProvider() { return localStorage.getItem(PROVIDER_STORAGE) || 'openai'; }
export function setApiKey(key, provider) {
  localStorage.setItem(KEY_STORAGE, key);
  localStorage.setItem(PROVIDER_STORAGE, provider);
}
export function clearApiKey() {
  localStorage.removeItem(KEY_STORAGE);
  localStorage.removeItem(PROVIDER_STORAGE);
}
export function hasApiKey() { return !!getApiKey(); }

async function callLLM(messages) {
  const key = getApiKey();
  const provider = getProvider();
  if (!key) throw new Error('No API key configured. Add one in Agents > Settings.');

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7 }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `OpenAI error ${res.status}`); }
    const data = await res.json();
    return data.choices[0].message.content;
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content || '',
      }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Anthropic error ${res.status}`); }
    const data = await res.json();
    return data.content[0].text;
  }
}

export async function runMarketingPlannerAgent(context) {
  const messages = [
    { role: 'system', content: 'You are a B2B marketing strategist for IT Impact Consulting, a recruiting + sales consulting firm. Generate a practical weekly social media content plan.' },
    { role: 'user', content: `Generate a 7-day social media content plan for LinkedIn, Instagram, and Facebook. Context: ${context || 'General B2B audience interested in sales consulting, recruiting, and AI engineering services.'}\n\nFor each day give: Platform, Post Type (e.g. thought leadership, case study, job posting, behind-the-scenes), and a punchy 1-sentence hook. Format as a clean list.` },
  ];
  return callLLM(messages);
}

export async function runLeadFinderAgent(context, existingLeads) {
  const messages = [
    { role: 'system', content: 'You are a B2B lead generation strategist. Suggest specific, actionable lead targets based on the ICP given.' },
    { role: 'user', content: `Based on this context: ${context}\n\nWe already have these leads/sectors: ${existingLeads || 'healthcare, PE/VC, dental'}.\n\nSuggest 8 new specific company types, titles, and outreach angles we should target. Be specific and practical, not generic.` },
  ];
  return callLLM(messages);
}

export async function runHRHeadhunterAgent(positionContext) {
  const messages = [
    { role: 'system', content: 'You are an expert technical/executive recruiter and headhunter.' },
    { role: 'user', content: `We are hiring for: ${positionContext}\n\nGive me: 1) 5 specific search strings/boolean queries to find candidates on LinkedIn, 2) 5 alternative job titles candidates might have, 3) 3 companies likely to have good candidates, 4) Key red flags to screen out.` },
  ];
  return callLLM(messages);
}

export async function runChatAssistant(question, dataContext) {
  const messages = [
    { role: 'system', content: `You are the AI assistant inside IT Impact's CRM dashboard. You help answer questions about leads, projects, recruiting, and sales pipeline. Here is a snapshot of current data:\n${dataContext}\n\nAnswer concisely and practically based on this data when relevant.` },
    { role: 'user', content: question },
  ];
  return callLLM(messages);
}
