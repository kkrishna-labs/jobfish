// Preferences form: what to look for, where, at which level, and which sources to use.
import { useState } from 'react';

const LEVELS = { intern: 'Internship', entry: 'Entry / fresher', mid: 'Mid', senior: 'Senior', lead: 'Lead+' };
const SOURCES = {
  ats: 'Company boards (Greenhouse, Lever, Ashby)',
  linkedin: 'LinkedIn',
  wellfound: 'Wellfound',
  internshala: 'Internshala',
  naukri: 'Naukri (uses Agent)',
};
const DEFAULTS = {
  roles: [], locations: [], country: 'India', remoteOk: false, seniority: [], keywords: [], exclude: [],
  postedWithinDays: 14, sources: ['ats', 'linkedin', 'wellfound', 'internshala'], careerUrls: [], agentLimit: 0,
};

const join = list => (list ?? []).join(', ');
const toggle = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

export default function SearchForm({ search, onSave, onDelete, running }) {
  const [name, setName] = useState(search.name ?? '');
  const [refreshHours, setRefreshHours] = useState(search.refreshHours ?? 0);
  const [p, setP] = useState(() => {
    const prefs = { ...DEFAULTS, ...search.prefs };
    return { ...prefs, roles: join(prefs.roles), locations: join(prefs.locations), keywords: join(prefs.keywords),
      exclude: join(prefs.exclude), careerUrls: (prefs.careerUrls ?? []).join('\n') };
  });
  const set = (key, value) => setP(prev => ({ ...prev, [key]: value }));
  const text = key => ({ value: p[key], onChange: e => set(key, e.target.value) });
  const submit = andRun => onSave({ ...search, name, refreshHours, prefs: { ...p, careerUrls: p.careerUrls.split(/\s+/) } }, andRun);

  return (
    <form className="card form" onSubmit={e => { e.preventDefault(); submit(true); }}>
      <label>Search name<input value={name} onChange={e => setName(e.target.value)} placeholder="Summer internships" /></label>
      <label>Roles <small>comma separated, up to 3</small><input required {...text('roles')} placeholder="software engineer intern, frontend developer" /></label>
      <label>Locations<input {...text('locations')} placeholder="Noida, Bengaluru" /></label>
      <label>Country<input {...text('country')} /></label>
      <label className="check"><input type="checkbox" checked={p.remoteOk} onChange={e => set('remoteOk', e.target.checked)} /> Remote is fine</label>

      <fieldset>
        <legend>Seniority <small>none = any</small></legend>
        {Object.entries(LEVELS).map(([key, label]) => (
          <label key={key} className="chip"><input type="checkbox" checked={p.seniority.includes(key)} onChange={() => set('seniority', toggle(p.seniority, key))} />{label}</label>
        ))}
      </fieldset>

      <label>Must-have keywords<input {...text('keywords')} placeholder="react, python" /></label>
      <label>Exclude words<input {...text('exclude')} placeholder="unpaid, sales" /></label>
      <label>Posted within
        <select value={p.postedWithinDays} onChange={e => set('postedWithinDays', e.target.value)}>
          {[1, 7, 14, 30].map(d => <option key={d} value={d}>{d === 1 ? '24 hours' : `${d} days`}</option>)}
        </select>
      </label>

      <fieldset>
        <legend>Sources</legend>
        {Object.entries(SOURCES).map(([key, label]) => (
          <label key={key} className="chip"><input type="checkbox" checked={p.sources.includes(key)} onChange={() => set('sources', toggle(p.sources, key))} />{label}</label>
        ))}
      </fieldset>

      <label>Company careers pages for the Agent <small>one URL per line, optional</small>
        <textarea rows={2} {...text('careerUrls')} placeholder="https://careers.example.com/jobs" />
      </label>
      <label>Agent runs per refresh <small>metered, ~$0.05–0.30 each; 0 = off</small>
        <input type="number" min={0} max={4} {...text('agentLimit')} />
      </label>
      <label>Auto-refresh
        <select value={refreshHours} onChange={e => setRefreshHours(Number(e.target.value))}>
          <option value={0}>Off</option><option value={6}>Every 6 hours</option>
          <option value={12}>Every 12 hours</option><option value={24}>Daily</option>
        </select>
      </label>

      <div className="actions">
        <button type="submit" className="primary" disabled={running}>Save &amp; run</button>
        <button type="button" onClick={() => submit(false)}>Save</button>
        {search._id && <button type="button" className="danger" onClick={() => onDelete(search)}>Delete</button>}
      </div>
    </form>
  );
}
