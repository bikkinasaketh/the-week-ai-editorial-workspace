const API = import.meta.env.VITE_API_URL || 'https://the-week-ai-editorial-workspace.onrender.com';
async function post(path, body) { const r = await fetch(`${API}/api/${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Request failed'); return data; }
export const researchSources = urls => post('research', {urls});
export const reviewDraft = text => post('writing', {text});
