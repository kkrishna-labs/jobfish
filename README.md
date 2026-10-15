# 🐟 JobFish: live job & internship finder powered by TinyFish

Built for the **TinyFish × TechnoJam** bounty ("AI That Clicks." workshop, Galgotias University).

Tell JobFish what you want (roles, locations, seniority, must-have and excluded keywords, remote OK). It pulls **live** openings
from company career boards and job portals, removes duplicates, ranks them against your preferences with a reason for each match,
and refreshes them on a schedule. New jobs get a **NEW** badge, and jobs that disappear are marked stale.

**Stack:** MongoDB · Express · React (Vite) · Node, with the official [`@tiny-fish/sdk`](https://docs.tinyfish.ai).

## How TinyFish is used

| TinyFish API     | What JobFish does with it                                                                                                                                                                                                                                                                                                                                                              | Code                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Search** | Discovers live postings for each *(role, location)* pair on public ATS boards (Greenhouse, Lever, Ashby) and on Wellfound and Internshala. Each Greenhouse hit also reveals a company that is hiring.                                                                                                                                                                                | `server/src/sources/ats.js`, `sources/portals.js`             |
| **Fetch**  | Reads what Search found: every hiring company's **whole Greenhouse board** (JSON API, so one fetch returns all openings), each Lever, Ashby, Wellfound and Internshala posting page, and **LinkedIn's public job search** built from your filters (posted within N days, experience level, remote). Closed postings ("applications are closed") are dropped.               | `sources/ats.js`, `sources/linkedin.js`, `sources/parse.js` |
| **Agent**  | For sites that need a real browser: **Naukri** (rendered in the browser, so Fetch can't read it) and **any company careers page you paste in**. The agent uses the site's own search and filters and returns structured listings through an `output_schema`. Progress and a live browser view stream to the UI. Agent is metered, so it's opt-in and capped per refresh. | `sources/agent.js`, `src/tinyfish.js`                         |

Search and Fetch are free, so scheduled refreshes use only them. Agent runs only when you refresh manually.

## Features (bounty checklist)

- **Working demo:** React UI plus a CLI dry run (`node server/scripts/dry-run.mjs`).
- **Your own preferences:** roles, locations, country, seniority, keywords, excluded words, remote, posting age, sources.
- **Multiple live sources:** Greenhouse, Lever and Ashby company boards; LinkedIn; Wellfound; Internshala; Naukri and custom careers pages through Agent.
- **Structured, deduplicated listings with apply links:** the same job found on several sites becomes one listing that keeps every source link and prefers the employer's own link.
- **Ranks results instead of dumping raw pages:** role synonyms (SDE = software engineer), seniority from titles, city aliases (Bangalore = Bengaluru, NCR counts as nearby), keywords and recency give a 0–100 score with reasons.
- **Results stay fresh:** auto-refresh every 6, 12 or 24 hours, NEW badges, stale tracking, and save / applied / hide marks.

## Run it

```bash
# 1. .env in the project root (see .env.example)
TINYFISH_API_KEY=...        # https://agent.tinyfish.ai/api-keys
MONGODB_URI=mongodb+srv://...  # free MongoDB Atlas cluster

# 2. install and start
npm install
npm run dev        # API on :5050, UI on http://localhost:5173
# or: npm run build && npm start   -> everything on http://localhost:5050

# tests (parsing, matching, dedupe) and a terminal-only run with no database
npm test -w server
node server/scripts/dry-run.mjs "frontend developer,software engineer intern" "Noida,Bengaluru" intern,entry
```

A sample refresh (*frontend developer / software engineer intern* in Noida and Bengaluru, intern and entry level): 18 searches and 77 pages
fetched, giving 1,349 live listings, 1,264 after dedupe, and **45 ranked matches** in about 55 seconds.

To study the code, see **[docs/CODE_MAP.md](docs/CODE_MAP.md)**.
