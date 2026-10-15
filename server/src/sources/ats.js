// Company job boards on public ATSs (Greenhouse, Lever, Ashby).
// Search finds postings for the user's roles; Fetch then reads each company's whole
// Greenhouse board (JSON API) and the individual Lever/Ashby posting pages.
import { combos } from '../prefs.js';
import { parsePage } from './parse.js';

const DOMAINS = 'job-boards.greenhouse.io,boards.greenhouse.io,jobs.lever.co,jobs.ashbyhq.com';
const GREENHOUSE_BOARD = /greenhouse\.io\/(?!embed)([\w-]+)/;
const POSTING = /^https:\/\/jobs\.(?:lever\.co|ashbyhq\.com)\/[\w.-]+\/[0-9a-f-]{36}/;

export default async function ats(prefs, ctx) {
  const hits = await ctx.searchAll(combos(prefs).map(([role, place]) => `${role} ${place}`), { include_domains: DOMAINS });

  const boards = [...new Set(hits.map(h => h.url.match(GREENHOUSE_BOARD)?.[1]).filter(Boolean))].slice(0, 12);
  const hints = new Map(hits.map(h => [h.url.match(POSTING)?.[0], h.title]).filter(([url]) => url));

  const [boardPages, postingPages] = await Promise.all([
    ctx.fetch(boards.map(b => `https://boards-api.greenhouse.io/v1/boards/${b}/jobs`), { format: 'html' }),
    ctx.fetch([...hints.keys()].slice(0, 20)),
  ]);

  return [
    ...boardPages.flatMap(greenhouseJobs),
    ...postingPages.map(p => parsePage(p, hints.get(p.url))).filter(Boolean),
  ];
}

function greenhouseJobs(page) {
  try {
    return JSON.parse(page.text).jobs.map(j => ({
      source: 'greenhouse',
      title: j.title,
      company: j.company_name,
      location: j.location?.name,
      url: j.absolute_url,
      postedAt: j.first_published ?? j.updated_at,
    }));
  } catch {
    return [];
  }
}
