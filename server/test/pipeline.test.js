// Unit tests for the offline parts of the pipeline: parsing, matching and dedupe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrefs, combos } from '../src/prefs.js';
import { score, levelOf } from '../src/match.js';
import { dedupe, canonicalUrl } from '../src/dedupe.js';
import { parseCards, searchUrl } from '../src/sources/linkedin.js';
import { parsePage } from '../src/sources/parse.js';
import { parseAgo } from '../src/text.js';

const prefs = normalizePrefs({ roles: 'frontend developer', locations: 'Noida', seniority: 'intern,entry', keywords: 'react' });

test('prefs: "Remote" as a location turns on remoteOk and adds a remote search pair', () => {
  const p = normalizePrefs({ roles: 'sde', locations: 'Pune, remote' });
  assert.deepEqual(p.locations, ['Pune']);
  assert.deepEqual(combos(p), [['sde', 'Pune'], ['sde', 'remote India']]);
});

test('match: synonyms, seniority and location decide what is kept', () => {
  const job = { title: 'Front-End Engineer Intern', company: 'Acme', location: 'Noida, Uttar Pradesh', text: 'React, TypeScript' };
  const r = score(job, prefs);
  assert.equal(r.keep, true);
  assert.ok(r.score >= 90, `score ${r.score}`);
  assert.ok(r.reasons.includes('Mentions react'));

  assert.equal(score({ ...job, title: 'Senior Frontend Engineer' }, prefs).keep, false); // wrong level
  assert.equal(score({ ...job, location: 'Berlin, Germany' }, prefs).keep, false); // wrong place
  assert.equal(score({ ...job, title: 'Sales Intern' }, prefs).keep, false); // wrong role
  assert.equal(score({ ...job, location: 'Gurugram, Haryana' }, prefs).reasons[1], 'Near noida (NCR)');
});

test('levelOf reads seniority from titles', () => {
  assert.equal(levelOf('Software Engineer II'), 'mid');
  assert.equal(levelOf('SDE Intern (Summer 2027)'), 'intern');
  assert.equal(levelOf('Staff Engineer'), 'lead');
  assert.equal(levelOf('Software Engineer'), null);
});

test('dedupe merges the same job from two sites and keeps the employer link', () => {
  const merged = dedupe([
    { source: 'linkedin', title: 'Frontend Intern', company: 'Acme', location: 'Noida, India', url: 'https://in.linkedin.com/jobs/view/frontend-intern-at-acme-1' },
    { source: 'lever', title: 'Frontend Intern', company: 'Acme', location: 'Noida', url: 'https://jobs.lever.co/acme/abc/apply' },
    { source: 'linkedin', title: 'Frontend Intern', company: 'Acme', location: 'Noida', url: 'https://www.linkedin.com/jobs/view/frontend-intern-at-acme-1?trk=x' },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'lever');
  assert.deepEqual(merged[0].sources.map(s => s.name), ['linkedin', 'lever']);
  assert.equal(canonicalUrl('https://jobs.lever.co/acme/abc/apply?lever-source=x'), 'jobs.lever.co/acme/abc');
});

test('linkedin: search URL carries the filters and cards pair with their links', () => {
  const url = new URL(searchUrl('frontend developer', 'Noida', prefs));
  assert.equal(url.searchParams.get('f_E'), '1,2');
  assert.equal(url.searchParams.get('f_TPR'), 'r1209600');

  const [job] = parseCards({
    text: '<ul><li><h3> Frontend Intern </h3><h4> Acme Labs </h4><p> Noida, India <time> 2 days ago </time></p></li></ul>',
    links: ['https://in.linkedin.com/jobs/view/other-role-at-x-9?position=1', 'https://in.linkedin.com/jobs/view/frontend-intern-at-acme-labs-42?position=2'],
  });
  assert.equal(job.url, 'https://www.linkedin.com/jobs/view/frontend-intern-at-acme-labs-42');
  assert.equal(job.company, 'Acme Labs');
  assert.equal(job.location, 'Noida, India');
  assert.ok(job.postedAt instanceof Date);
});

test('parsePage reads Internshala and Wellfound titles and spots closed postings', () => {
  const intern = parsePage({
    url: 'https://internshala.com/internship/detail/web-development-internship-in-noida-at-acme1',
    title: 'Web Development Internship in Noida at Acme',
    text: 'Applications are closed for this internship.\n\nStipend\n\n₹ 10,000 /month\n\nPosted 3 weeks ago',
  });
  assert.deepEqual([intern.title, intern.location, intern.company, intern.salary, intern.closed],
    ['Web Development Internship', 'Noida', 'Acme', '₹ 10,000 /month', true]);

  const wf = parsePage({ url: 'https://wellfound.com/jobs/1-x', title: 'Full Stack Engineer Intern at AI47Labs • Noida', text: 'Reposted: 2 weeks ago' });
  assert.deepEqual([wf.title, wf.company, wf.location, wf.postedText], ['Full Stack Engineer Intern', 'AI47Labs', 'Noida', '2 weeks ago']);
});

test('parseAgo understands relative dates', () => {
  assert.ok(Math.abs(Date.now() - 3 * 864e5 - parseAgo('Posted 3 days ago')) < 1000);
  assert.equal(parseAgo('sometime'), null);
});
