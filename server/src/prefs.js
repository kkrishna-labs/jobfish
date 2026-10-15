// User preferences: defaults, cleanup, and the (role, location) pairs each source searches.

export const SOURCES = ['ats', 'linkedin', 'wellfound', 'internshala', 'naukri'];
export const LEVELS = ['intern', 'entry', 'mid', 'senior', 'lead'];

const list = v => (Array.isArray(v) ? v : String(v ?? '').split(','))
  .map(s => String(s).trim()).filter(Boolean);

export function normalizePrefs(p = {}) {
  const places = list(p.locations);
  const wantsRemote = places.some(l => /^remote$/i.test(l));
  return {
    roles: list(p.roles).slice(0, 3),
    locations: places.filter(l => !/^remote$/i.test(l)).slice(0, 3),
    country: String(p.country ?? 'India').trim() || 'India',
    remoteOk: Boolean(p.remoteOk) || wantsRemote,
    seniority: list(p.seniority).filter(l => LEVELS.includes(l)),
    keywords: list(p.keywords).slice(0, 10),
    exclude: list(p.exclude).slice(0, 10),
    postedWithinDays: [1, 7, 14, 30].includes(Number(p.postedWithinDays)) ? Number(p.postedWithinDays) : 14,
    sources: list(p.sources ?? ['ats', 'linkedin', 'wellfound', 'internshala']).filter(s => SOURCES.includes(s)),
    careerUrls: list(p.careerUrls).filter(u => /^https?:\/\//.test(u)).slice(0, 3),
    agentLimit: Math.min(Math.max(Number(p.agentLimit) || 0, 0), 4),
  };
}

/** Every (role, location) pair to search, plus a remote pair when remote work is OK. */
export function combos(prefs, max = 6) {
  const places = [...prefs.locations, ...(prefs.remoteOk ? [`remote ${prefs.country}`] : [])];
  return prefs.roles
    .flatMap(role => (places.length ? places : [prefs.country]).map(place => [role, place]))
    .slice(0, max);
}
