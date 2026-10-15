// One refresh of a saved search: sources -> clean -> dedupe -> score -> save.
import { search, fetchPages, runAgent } from './tinyfish.js';
import { Job } from './models.js';
import { dedupe } from './dedupe.js';
import { score } from './match.js';
import { clean, parseAgo } from './text.js';
import ats from './sources/ats.js';
import linkedin from './sources/linkedin.js';
import { portal } from './sources/portals.js';
import agent from './sources/agent.js';

const SOURCES = { ats, linkedin, wellfound: portal('wellfound'), internshala: portal('internshala') };

export async function runSearch(doc, emit, options) {
  const runAt = new Date();
  const { matches, stats } = await collect(doc.prefs, emit, options);
  stats.new = await save(doc, matches, runAt);
  doc.lastRun = { at: runAt, stats };
  await doc.save();
  emit({ type: 'done', stats });
  return stats;
}

/** Run every enabled source in parallel and return the deduplicated, scored matches. */
export async function collect(prefs, emit, { allowAgent = true } = {}) {
  const ctx = context(emit);
  const tasks = Object.entries(SOURCES).filter(([name]) => prefs.sources.includes(name));
  if (allowAgent && prefs.agentLimit > 0) tasks.push(['agent', agent]);

  const batches = await Promise.all(tasks.map(async ([name, source]) => {
    emit({ type: 'source', source: name, message: 'searching…' });
    const found = await source(prefs, ctx).catch(err => (ctx.warn(`${name} failed: ${err.message}`), []));
    emit({ type: 'source', source: name, message: `${found.length} listings`, count: found.length });
    return found;
  }));

  const listings = batches.flat().map(tidy).filter(j => j.title && j.url && !j.closed);
  const unique = dedupe(listings);
  const matches = unique.map(j => ({ ...j, ...score(j, prefs) })).filter(j => j.keep);
  emit({ type: 'match', message: `${listings.length} live listings → ${unique.length} unique → ${matches.length} match your preferences` });

  const stats = { ...ctx.usage, listings: listings.length, unique: unique.length, matches: matches.length };
  return { matches, stats };
}

function tidy(job) {
  let url;
  try { url = new URL(job.url).href; } catch { url = null; }
  const postedAt = job.postedAt ? new Date(job.postedAt) : parseAgo(job.postedText);
  return {
    ...job,
    url,
    title: clean(job.title),
    company: clean(job.company).replace(/\s+(job board|careers)$/i, ''),
    location: clean(job.location),
    postedAt: postedAt && !isNaN(postedAt) ? postedAt : null,
  };
}

/** Upsert matches; jobs missing from this refresh are marked stale. Returns the number of new jobs. */
async function save(doc, matches, runAt) {
  if (matches.length) {
    await Job.bulkWrite(matches.map(j => ({
      updateOne: {
        filter: { search: doc._id, key: j.key },
        update: {
          $set: {
            title: j.title, company: j.company, location: j.location, url: j.url, sources: j.sources,
            level: j.level, remote: j.remote, type: j.type, salary: j.salary, postedAt: j.postedAt,
            score: j.score, reasons: j.reasons, lastSeenAt: runAt, stale: false,
          },
          $setOnInsert: { firstSeenAt: runAt },
        },
        upsert: true,
      },
    })));
  }
  await Job.updateMany({ search: doc._id, lastSeenAt: { $lt: runAt } }, { stale: true });
  return Job.countDocuments({ search: doc._id, firstSeenAt: { $gte: runAt } });
}

// What each source gets: TinyFish calls that never throw, report problems, and count usage.
function context(emit) {
  const usage = { searches: 0, pages: 0, agentRuns: 0 };
  const warn = message => emit({ type: 'warn', message });
  return {
    usage,
    warn,
    async searchAll(queries, options) {
      usage.searches += queries.length;
      const results = await Promise.all(queries.map(q =>
        search(q, options).catch(err => (warn(`Search "${q}": ${err.message}`), []))));
      return results.flat();
    },
    async fetch(urls, options) {
      if (!urls.length) return [];
      const { pages, errors } = await fetchPages(urls, options);
      usage.pages += pages.length;
      if (errors.length) warn(`Fetch skipped ${errors.length} page(s): ${[...new Set(errors.map(e => e.error))].join(', ')}`);
      return pages;
    },
    async agent({ url, goal }) {
      usage.agentRuns++;
      emit({ type: 'agent', url, message: 'Agent started' });
      try {
        const jobs = await runAgent({ url, goal, onEvent: e => emit({ type: 'agent', url, ...e }) });
        emit({ type: 'agent', url, message: `Agent returned ${jobs.length} listings` });
        return jobs;
      } catch (err) {
        warn(`Agent on ${url}: ${err.message}`);
        return [];
      }
    },
  };
}
