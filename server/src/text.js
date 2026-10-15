// Small text helpers shared by the parsers, matcher and dedupe.

export const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();

export const slug = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const decode = s => String(s ?? '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

export const stripTags = html => clean(decode(String(html ?? '').replace(/<[^>]+>/g, ' ')));

export const hostOf = url => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const UNIT_MS = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 };

/** "3 days ago", "Posted 2 weeks ago", "12 hours ago" -> Date (or null). */
export function parseAgo(text) {
  const t = clean(text).toLowerCase();
  if (/just now|today|few (seconds|minutes|hours)/.test(t)) return new Date();
  const m = t.match(/(\d+|an?|one)\+?\s*(minute|hour|day|week|month)s?\s+ago/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  return new Date(Date.now() - n * UNIT_MS[m[2]]);
}

// Phrases job sites show on postings that no longer take applications.
const CLOSED = /no longer accepting applications|applications are closed|job is no longer available|position has been filled|this job has expired|keine Bewerbungen mehr/i;

export const isClosed = text => CLOSED.test(text ?? '');
