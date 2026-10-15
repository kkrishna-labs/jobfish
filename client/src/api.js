// Tiny client for the Express API.
async function call(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.status === 204 ? null : res.json();
}

export const api = {
  health: () => call('GET', '/health'),
  searches: () => call('GET', '/searches'),
  saveSearch: s => (s._id ? call('PUT', `/searches/${s._id}`, s) : call('POST', '/searches', s)),
  deleteSearch: id => call('DELETE', `/searches/${id}`),
  run: id => call('POST', `/searches/${id}/run`),
  jobs: id => call('GET', `/searches/${id}/jobs`),
  markJob: (id, mark) => call('PATCH', `/jobs/${id}`, { mark }),
  // Server-Sent Events: calls onEvent for each progress event until the run ends.
  follow(runId, onEvent) {
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = e => {
      const event = JSON.parse(e.data);
      onEvent(event);
      if (event.type === 'end') source.close();
    };
    source.onerror = () => source.close();
    return () => source.close();
  },
};
