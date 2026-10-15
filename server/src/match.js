// Score each listing against the user's preferences, drop mismatches, and explain matches.
import { clean } from './text.js';

// Normalise wording so "SDE", "Software Developer" and "software engineer" compare equal.
const ALIASES = [
  [/\bfront[\s-]?end\b/g, 'frontend'], [/\bback[\s-]?end\b/g, 'backend'], [/\bfull[\s-]?stack\b/g, 'fullstack'],
  [/\b(sde|swe)\b/g, 'software engineer'], [/\b(developer|development|dev|programmer)\b/g, 'engineer'],
  [/\b(internship|interns|trainee)\b/g, 'intern'], [/\bml\b/g, 'machine learning'],
];
const IGNORED = new Set(['a', 'an', 'and', 'or', 'the', 'of', 'for', 'in', 'at', 'to', 'with', 'job', 'jobs',
  'intern', 'senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal']);

const normalize = s => ALIASES.reduce((t, [re, to]) => t.replace(re, to), clean(s).toLowerCase().replace(/[^a-z0-9+#]+/g, ' '));
const words = s => normalize(s).split(' ').filter(w => w && !IGNORED.has(w));

const LEVEL_RULES = [
  ['intern', /\b(intern|internship|trainee|apprentice)\b/],
  ['lead', /\b(lead|principal|staff|head|director|manager|architect)\b/],
  ['senior', /\b(senior|sr|iii|iv)\b/],
  ['entry', /\b(junior|jr|entry|graduate|grad|fresher|associate|i)\b/],
  ['mid', /\b(ii|mid)\b/],
];
export const levelOf = (title, type = '') =>
  LEVEL_RULES.find(([, re]) => re.test(`${title} ${type}`.toLowerCase()))?.[0] ?? null;

// Same city under different names, and the NCR cities that count as "nearby" each other.
const SAME_CITY = [['bengaluru', 'bangalore'], ['gurugram', 'gurgaon'], ['mumbai', 'bombay'], ['chennai', 'madras'], ['delhi', 'new delhi']];
const NCR = ['delhi', 'noida', 'greater noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad'];
const names = place => SAME_CITY.find(g => g.includes(place)) ?? [place];
const isRemote = job => /\b(remote|work from home|wfh)\b/i.test(`${job.location} ${job.title}`);

function placeScore(job, prefs) {
  const where = `${job.location ?? ''} ${job.title}`.toLowerCase();
  if (prefs.remoteOk && isRemote(job)) return [20, 'Remote'];
  if (!prefs.locations.length) return [10, null];
  const wanted = prefs.locations.map(l => l.toLowerCase());
  const exact = wanted.find(l => names(l).some(n => where.includes(n)));
  if (exact) return [20, `In ${exact}`];
  const near = wanted.find(l => NCR.includes(l) && NCR.some(n => where.includes(n)));
  if (near) return [12, `Near ${near} (NCR)`];
  if (!clean(job.location)) return [6, null];
  if (/^(india|multiple locations|pan india|anywhere)/i.test(clean(job.location))) return [8, 'Multiple locations'];
  return [-1, null];
}

function roleScore(job, prefs) {
  const title = new Set(words(job.title));
  let best = [0, null];
  for (const role of prefs.roles) {
    const want = words(role);
    const hit = want.length ? want.filter(w => title.has(w)).length / want.length : 0;
    if (hit > best[0]) best = [hit, role];
  }
  return best;
}

/** Returns { keep, score 0-100, level, remote, reasons[] }. */
export function score(job, prefs) {
  const [roleHit, role] = roleScore(job, prefs);
  if (roleHit < 0.6) return { keep: false };

  const haystack = normalize(`${job.title} ${job.company} ${job.text ?? ''}`);
  if (prefs.exclude.some(w => normalize(`${job.title} ${job.company}`).includes(normalize(w)))) return { keep: false };

  const level = levelOf(job.title, job.type);
  if (prefs.seniority.length && level && !prefs.seniority.includes(level)) return { keep: false };

  const [placePts, placeWhy] = placeScore(job, prefs);
  if (placePts < 0) return { keep: false };

  const found = prefs.keywords.filter(k => haystack.includes(normalize(k)));
  const days = job.postedAt ? (Date.now() - new Date(job.postedAt)) / 864e5 : Infinity;
  const fresh = days <= 3 ? 5 : days <= prefs.postedWithinDays ? 3 : 0;

  const points = 50 * roleHit
    + placePts
    + (!prefs.seniority.length ? 10 : level ? 15 : 8)
    + (prefs.keywords.length ? (10 * found.length) / prefs.keywords.length : 5)
    + fresh;

  return {
    keep: true,
    score: Math.round(Math.min(points, 100)),
    level,
    remote: isRemote(job),
    reasons: [
      `Matches "${role}"`,
      placeWhy,
      level && prefs.seniority.includes(level) && `${level} level`,
      ...found.map(k => `Mentions ${k}`),
      fresh === 5 && 'Posted in the last 3 days',
    ].filter(Boolean),
  };
}
