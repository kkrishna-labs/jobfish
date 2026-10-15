// TinyFish Agent for sites that need a real browser: Naukri (client-rendered, Fetch can't read it)
// and any company careers page the user adds. Agent is metered, so runs are capped by prefs.agentLimit.
import { combos } from '../prefs.js';
import { hostOf, slug } from '../text.js';

const NO_ACTIONS = 'Do not log in, sign up or apply.';
const RETURN = 'For each listing return title, company, location, the absolute URL of the posting, when it was posted and salary if shown. Only return listings that are really on the site.';

function targets(prefs) {
  const [role, place] = combos(prefs)[0] ?? [];
  const city = place?.startsWith('remote') ? '' : place;
  const naukri = {
    url: `https://www.naukri.com/${slug(role)}-jobs${city ? `-in-${slug(city)}` : ''}`,
    goal: `This is a Naukri job search results page. ${NO_ACTIONS} Extract up to 15 job listings. ${RETURN}`,
  };
  const careers = url => ({
    url,
    goal: `On this careers site, find open positions matching "${prefs.roles.join('" or "')}"`
      + `${prefs.locations.length ? ` in ${prefs.locations.join(' or ')}` : ''}. Use the site's job search or filters if it has them. `
      + `${NO_ACTIONS} Return up to 15 matching listings. ${RETURN} If nothing matches, return an empty list.`,
  });
  return [
    ...prefs.careerUrls.map(careers),
    ...(prefs.sources.includes('naukri') && role ? [naukri] : []),
  ].slice(0, prefs.agentLimit);
}

export default async function agent(prefs, ctx) {
  const runs = await Promise.all(targets(prefs).map(async t => {
    const jobs = await ctx.agent(t);
    const source = hostOf(t.url).includes('naukri') ? 'naukri' : 'careers';
    return jobs.map(j => ({
      source,
      title: j.title,
      company: j.company,
      location: j.location,
      url: new URL(j.url, t.url).href,
      postedText: j.posted,
      salary: j.salary,
    }));
  }));
  return runs.flat();
}
