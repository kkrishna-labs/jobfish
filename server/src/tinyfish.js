// Thin wrapper around the official TinyFish SDK (Search, Fetch, Agent),
// with small concurrency limits so we stay inside the account's rate limits.
import { TinyFish } from '@tiny-fish/sdk';

let client;
const tf = () => (client ??= new TinyFish()); // reads TINYFISH_API_KEY

function limiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { task, resolve, reject } = queue.shift();
    task().then(resolve, reject).finally(() => { active--; next(); });
  };
  return task => new Promise((resolve, reject) => { queue.push({ task, resolve, reject }); next(); });
}
const limit = { search: limiter(4), fetch: limiter(4), agent: limiter(2) };

/** Search: ranked live web results for a query. */
export async function search(query, options = {}) {
  const res = await limit.search(() => tf().search.query({ query, ...options }));
  return res.results;
}

/** Fetch: render pages in a real browser and return clean content (max 10 URLs per call). */
export async function fetchPages(urls, { format = 'markdown', links = false } = {}) {
  const unique = [...new Set(urls)];
  const batches = [];
  for (let i = 0; i < unique.length; i += 10) batches.push(unique.slice(i, i + 10));

  const responses = await Promise.all(batches.map(batch => limit.fetch(() =>
    tf().fetch.getContents({ urls: batch, format, links, ttl: 3600, per_url_timeout_ms: 45_000 })
      .catch(err => ({ results: [], errors: batch.map(url => ({ url, error: err.message })) })))));

  return {
    pages: responses.flatMap(r => r.results),
    errors: responses.flatMap(r => r.errors),
  };
}

const JOBS_SCHEMA = {
  type: 'object',
  properties: {
    jobs: {
      type: 'array',
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string', nullable: true },
          url: { type: 'string' },
          posted: { type: 'string', nullable: true },
          salary: { type: 'string', nullable: true },
        },
        required: ['title', 'company', 'url'],
      },
    },
  },
  required: ['jobs'],
};

/** Agent: drive a real browser toward a goal and return structured job listings. */
export function runAgent({ url, goal, onEvent = () => {}, timeoutMs = 240_000 }) {
  return limit.agent(async () => {
    const stream = await tf().agent.stream({ url, goal, output_schema: JOBS_SCHEMA });
    let runId;
    const timer = setTimeout(() => { if (runId) cancelRun(runId); stream.close(); }, timeoutMs);
    try {
      for await (const event of stream) {
        if (event.type === 'STARTED') runId = event.run_id;
        else if (event.type === 'STREAMING_URL') onEvent({ liveUrl: event.streaming_url });
        else if (event.type === 'PROGRESS') onEvent({ message: event.purpose });
        else if (event.type === 'COMPLETE') {
          if (event.status !== 'COMPLETED') throw new Error(event.error?.message ?? `run ${event.status}`);
          return event.result?.jobs ?? [];
        }
      }
      throw new Error('timed out');
    } finally {
      clearTimeout(timer);
    }
  });
}

// The SDK has no cancel helper yet, so call the REST endpoint directly.
const cancelRun = runId => fetch(`https://agent.tinyfish.ai/v1/runs/${runId}/cancel`, {
  method: 'POST',
  headers: { 'X-API-Key': process.env.TINYFISH_API_KEY },
}).catch(() => {});
