# AI Use-Case Factory

A working prototype of the **AI Use-Case Factory**: one web platform that takes a business problem from intake to an AI Council decision, and then tracks the value after go-live.

> **Demo – synthetic data only.** No real client data is in this repository. Business context and requirements are in [`CLAUDE.md`](CLAUDE.md).

## What it does

| Step | What happens | Where |
|---|---|---|
| 1 Submit | Chat intake (or classic form) → structured problem summary → user confirms | `/submit` |
| 2 Sort & route | Similarity check vs. register and asset catalogue; routing Q1–Q4 → R1–R5; merge, link, cluster | Request → *Similar & route*, `/triage` |
| 3 Map & reuse | Process map from SOPs / process documents (RAG, with citations) or from the interview; AI opportunity per step; reuse options; analyst checkpoint | Request → *Process map & reuse* |
| 4 Simulate & value | Baseline vs. with-AI per step; 6 value levers; adoption ramp; Monte Carlo P10/P50/P90; quality flags; every number shows source + confidence; every edit is logged | Request → *Simulation & value* |
| 5 Design & cost | Governance pre-check (GxP → CSV/CSA), cost cards → 5-year TCO, payback, ROI; draft architecture with Mermaid diagram | Request → *Design & cost* |
| 6 Case & approval | Business case (Markdown → .docx / print-to-PDF) and Council slides (.pptx); L1/L2/L3 workflow with Finance step, deadlines, mock email outbox, decision log | Request → *Business case* / *Approvals*, `/approvals`, `/council`, `/outbox` |
| 6b Publish | Marketplace with tiers (Personal / Team / Certified), review dates, usage, ratings | `/marketplace` |
| 7 Track value | Actuals at M3/M6/M12 vs. expected; portfolio dashboard; estimate accuracy per AI pattern | Request → *Value tracking*, `/value` |

Also: register with filters and Excel export, cluster view, role-based home dashboard, admin screens for settings, thresholds, levers, benchmarks, cost rates, cost cards, asset catalogue, software capabilities, process document library, users and roles, and a **Reset demo data** button.

## Quick start

Requirements: Node.js 20+.

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

Open http://localhost:3000. Use the **Acting as** switcher in the top bar to change role (requester, pod analyst, architect, Finance, Council member, chair, Head of Digital & AI, admin).

`npm run setup` creates `.env` from `.env.example` (if missing), creates the SQLite database and loads the synthetic demo data. Run it again (or use *Admin → Demo data → Reset*) before each showcase.

## AI provider

All LLM calls go through one provider interface (`lib/llm/`). Every task uses a versioned prompt (`prompts/<task>.v1.md`), returns JSON validated with Zod, retries once on invalid output and then falls back to a rule-based draft that the user can edit.

| `LLM_PROVIDER` | Behaviour |
|---|---|
| `mock` (default) | Deterministic rule-based drafts. Works offline. Good for repeatable demos. |
| `anthropic` | Claude via the Anthropic SDK. Set `ANTHROPIC_API_KEY` (model: `ANTHROPIC_MODEL`, default `claude-opus-5-5`). |
| `azure` | Azure OpenAI / AI Foundry. Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`. |

**The LLM never calculates numbers.** It proposes inputs and writes text. `lib/value/` computes all values, totals, ROI and flags, and the business case gets the calculated numbers passed in.

## Tests

```bash
npm test
```

Unit tests for the value engine, flags, Monte Carlo, approval levels and routing rules (`tests/*.test.ts`).

End-to-end run of the full demo script in a real browser (start the app first; needs Playwright with Chromium):

```bash
npm run e2e
```

## Project layout

```
app/                 Next.js App Router pages, server actions (app/actions) and file routes (app/api)
components/          UI components; components/request/* are the request-detail tabs
lib/value/           levers, calc, flags, Monte Carlo (pure, unit-tested)
lib/approval/        approval levels and working-day rules (pure, unit-tested)
lib/routing/         routing rules Q1–Q4 (pure, unit-tested)
lib/similarity/      local embeddings + cosine
lib/llm/, lib/prompts/  provider interface (Anthropic, Azure OpenAI, mock) and prompt loader
lib/ai/              Zod schemas and task logic with rule-based fallbacks
lib/services/        triage, mapping, value, design, business case, workflow, register
lib/export/          .pptx, .docx, .xlsx
lib/notify/, lib/audit/  mock email outbox, audit and edit logs
lib/seed/            synthetic demo data
prompts/             versioned prompt files
prisma/              schema and seed entry point
docs/                architecture, demo script, decisions
```

See [`docs/demo-script.md`](docs/demo-script.md) for the 15-minute showcase, [`docs/architecture.md`](docs/architecture.md) for the design and [`docs/decisions.md`](docs/decisions.md) for the choices made.
