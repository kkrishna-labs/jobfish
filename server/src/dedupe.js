// Collapse the same posting found on several sites (or by several queries) into one listing.
import { slug } from './text.js';

/** URL without tracking params, "www."/"in." prefixes or trailing "/apply". */
export function canonicalUrl(url) {
  const u = new URL(url);
  const jobId = u.searchParams.get('gh_jid'); // Greenhouse job id lives in the query
  const path = u.pathname.replace(/\/(apply|application)\/?$/, '').replace(/\/$/, '');
  return `${u.hostname.replace(/^(www|in)\./, '')}${path}${jobId ? `?gh_jid=${jobId}` : ''}`.toLowerCase();
}

/** company | title | first city — the same job posted on two different sites. */
export const fingerprint = job =>
  [job.company, job.title, (job.location ?? '').split(/[,;/|(]/)[0]].map(slug).join('|');

// When duplicates disagree, keep the link closest to the employer.
const DIRECT = new Set(['greenhouse', 'lever', 'ashby', 'careers']);

export function dedupe(listings) {
  const seen = new Map();
  const unique = [];
  for (const job of listings) {
    const keys = [canonicalUrl(job.url), job.company ? fingerprint(job) : null].filter(Boolean);
    const twin = keys.map(k => seen.get(k)).find(Boolean);
    if (!twin) {
      const entry = { ...job, key: keys.at(-1), sources: [{ name: job.source, url: job.url }] };
      unique.push(entry);
      keys.forEach(k => seen.set(k, entry));
      continue;
    }
    if (!twin.sources.some(s => s.name === job.source)) twin.sources.push({ name: job.source, url: job.url });
    for (const field of ['location', 'postedAt', 'salary', 'type', 'text']) twin[field] ??= job[field];
    if (DIRECT.has(job.source) && !DIRECT.has(twin.source)) Object.assign(twin, { url: job.url, source: job.source });
    keys.forEach(k => seen.set(k, twin));
  }
  return unique;
}
