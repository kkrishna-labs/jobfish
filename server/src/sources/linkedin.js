// LinkedIn's public job search. We build the search URL from the preferences
// (role, place, posting age, experience level) and read the result cards with Fetch.
import { combos } from '../prefs.js';
import { parseAgo, slug, stripTags } from '../text.js';

const LEVEL_CODES = { intern: '1', entry: '2', mid: '3,4', senior: '4', lead: '5' };

export function searchUrl(role, place, prefs) {
  const remote = place.startsWith('remote');
  const params = new URLSearchParams({
    keywords: role,
    location: remote ? prefs.country : place,
    f_TPR: `r${prefs.postedWithinDays * 86400}`,
  });
  const levels = [...new Set(prefs.seniority.flatMap(l => LEVEL_CODES[l].split(',')))];
  if (levels.length) params.set('f_E', levels.join(','));
  if (remote) params.set('f_WT', '2');
  return `https://www.linkedin.com/jobs/search?${params}`;
}

export default async function linkedin(prefs, ctx) {
  const urls = combos(prefs).map(([role, place]) => searchUrl(role, place, prefs));
  const pages = await ctx.fetch(urls, { format: 'html', links: true });
  return pages.flatMap(parseCards);
}

// Each result card is an <li> with <h3>title</h3><h4>company</h4><p>location<time>age</time></p>.
// Card links come back separately in `links`; a job link's slug starts with the job title,
// e.g. /jobs/view/frontend-intern-at-acme-4476566367, which pairs it with its card.
export function parseCards(page) {
  const links = [...new Set((page.links ?? [])
    .map(l => l.match(/linkedin\.com\/jobs\/view\/([^?#]+)/)?.[1])
    .filter(Boolean))];
  const cards = (page.text ?? '').split('<li>').filter(c => c.includes('<h3>'));
  return cards.map(card => {
    const title = stripTags(card.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]);
    const path = links.find(l => l.startsWith(`${slug(title)}-at-`));
    const url = path && `https://www.linkedin.com/jobs/view/${path}`;
    const ago = stripTags(card.match(/<time>([\s\S]*?)<\/time>/)?.[1]);
    return {
      source: 'linkedin',
      url,
      title,
      company: stripTags(card.match(/<h4>([\s\S]*?)<\/h4>/)?.[1]) || companyFromSlug(url),
      location: stripTags(card.match(/<p>([^<]*)<time>/)?.[1]),
      postedAt: parseAgo(ago),
    };
  }).filter(j => j.title && j.url);
}

// ".../jobs/view/frontend-intern-at-acme-labs-4476566367" -> "acme labs"
const companyFromSlug = url => url?.match(/-at-(.+)-\d+$/)?.[1].replace(/-/g, ' ');
