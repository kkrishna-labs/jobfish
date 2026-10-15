// Run the pipeline from the terminal without a database:
//   node scripts/dry-run.mjs "software engineer intern" "Noida,Bengaluru" intern,entry
import '../src/env.js';
import { collect } from '../src/pipeline.js';
import { normalizePrefs } from '../src/prefs.js';

const [roles = 'software engineer', locations = 'Bengaluru', seniority = ''] = process.argv.slice(2);
const prefs = normalizePrefs({ roles, locations, seniority, remoteOk: true });
const { matches, stats } = await collect(prefs, e => console.log(`[${e.type}]`, e.source ?? '', e.message ?? ''), { allowAgent: false });

matches.sort((a, b) => b.score - a.score).slice(0, 25).forEach(j =>
  console.log(String(j.score).padStart(3), j.title, '·', j.company, '·', j.location, '·', j.sources.map(s => s.name).join('+'), '\n    ', j.url));
console.log(stats);
