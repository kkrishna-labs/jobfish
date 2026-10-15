// Job portals (Wellfound, Internshala): Search finds postings and listing pages,
// Fetch follows listing pages to more postings and reads each posting page.
import { combos } from '../prefs.js';
import { parsePage } from './parse.js';

const PORTALS = {
  wellfound: {
    domain: 'wellfound.com',
    query: (role, place) => `${role} ${place}`,
    posting: /wellfound\.com\/jobs\/\d+/,
  },
  internshala: {
    domain: 'internshala.com',
    query: (role, place) => `${role} internship ${place}`,
    posting: /internshala\.com\/(?:internship|job)\/detail\//,
    listing: /internshala\.com\/(?:internships|jobs)\//,
  },
};

export const portal = name => async (prefs, ctx) => {
  const cfg = PORTALS[name];
  const hits = await ctx.searchAll(combos(prefs).map(([role, place]) => cfg.query(role, place)), { include_domains: cfg.domain });
  const urls = hits.map(h => h.url);
  const postings = urls.filter(u => cfg.posting.test(u));

  const listings = cfg.listing ? urls.filter(u => cfg.listing.test(u)).slice(0, 3) : [];
  for (const page of await ctx.fetch(listings, { links: true })) {
    postings.push(...(page.links ?? []).filter(u => cfg.posting.test(u)));
  }

  const pages = await ctx.fetch([...new Set(postings)].slice(0, 20));
  return pages.map(p => parsePage(p)).filter(Boolean);
};
