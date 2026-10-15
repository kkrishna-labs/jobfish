// In-memory registry of refresh runs, so the UI can follow progress over Server-Sent Events.
import { randomUUID } from 'node:crypto';
import { runSearch } from './pipeline.js';

const runs = new Map(); // runId -> { events, clients, done }
const active = new Map(); // searchId -> runId (one run per search at a time)

export function startRun(doc, options) {
  const searchId = String(doc._id);
  if (active.has(searchId)) return active.get(searchId);

  const id = randomUUID();
  const run = { events: [], clients: new Set(), done: false };
  runs.set(id, run);
  active.set(searchId, id);

  const emit = event => {
    const line = `data: ${JSON.stringify({ at: Date.now(), ...event })}\n\n`;
    run.events.push(line);
    for (const res of run.clients) res.write(line);
  };

  runSearch(doc, emit, options)
    .catch(err => emit({ type: 'error', message: err.message }))
    .finally(() => {
      emit({ type: 'end' });
      run.done = true;
      active.delete(searchId);
      for (const res of run.clients) res.end();
      setTimeout(() => runs.delete(id), 30 * 60_000);
    });

  return id;
}

export function followRun(id, res) {
  const run = runs.get(id);
  if (!run) return res.sendStatus(404);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  run.events.forEach(line => res.write(line)); // replay what already happened
  if (run.done) return res.end();
  run.clients.add(res);
  res.on('close', () => run.clients.delete(res));
}
