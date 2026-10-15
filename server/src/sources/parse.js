// One small parser per job site: turns a page read by TinyFish Fetch into a listing.
import { clean, hostOf, isClosed } from '../text.js';

// Text on the line(s) after a markdown heading, e.g. "## Location\n\nNoida" -> "Noida".
const after = (text, heading) => clean(text.match(new RegExp(`^#+ ${heading}\\s*\\n+(.+)`, 'mi'))?.[1]);
// jobs.ashbyhq.com/interview-kickstart/... -> "interview kickstart"
const orgFromUrl = url => new URL(url).pathname.split('/')[1].replace(/-/g, ' ');
const ago = text => text.match(/(?:Reposted|Posted):?\s+([^•\n]*?ago)/i)?.[1];

const PARSERS = {
  // Page title "Company - Job"; body "## Job\n\nLocation\n\nTeam /\n\nCommitment /\n\nWorkplace"
  'jobs.lever.co': ({ title, text }) => {
    const [company, ...job] = title.split(' - ');
    const meta = text.split(/apply for this job/i)[0].split('\n').map(clean).filter(Boolean);
    return {
      source: 'lever', company, title: job.join(' - '), location: meta[1],
      type: meta.find(l => /intern|full|part|contract/i.test(l))?.replace(/\s*\/$/, ''),
    };
  },
  // Page title is the job; the company comes from the search hit ("Job @ Company").
  'jobs.ashbyhq.com': ({ title, text, url }, hint = '') => ({
    source: 'ashby', title, company: hint.split(' @ ')[1] ?? orgFromUrl(url),
    location: after(text, 'Location'), type: after(text, 'Employment Type'),
  }),
  // Page title "Job at Company • Location"
  'wellfound.com': ({ title, text }) => {
    const m = title.match(/^(.+) at (.+?) • (.+)$/);
    return m && { source: 'wellfound', title: m[1], company: m[2], location: m[3], postedText: ago(text) };
  },
  // Page title "Role Internship in City at Company" (no city for work-from-home roles)
  'internshala.com': ({ title, text }) => {
    const m = title.match(/^(.+?)(?: in (.+))? at (.+)$/);
    return m && {
      source: 'internshala', title: m[1], company: m[3], location: m[2] ?? 'Remote', type: 'Internship',
      salary: text.match(/Stipend\s*\n+\s*(.+)/)?.[1], postedText: ago(text),
    };
  },
};

export function parsePage(page, hint) {
  const parse = PARSERS[hostOf(page.url)];
  const job = parse?.({ title: clean(page.title), text: page.text ?? '', url: page.url }, hint);
  if (!job?.title) return null;
  return { ...job, url: page.url, closed: isClosed(page.text), text: page.text?.slice(0, 4000) };
}
