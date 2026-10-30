# Decisions

Choices made where the brief was open. Each keeps the demo script working with the simplest option.

1. **Stack versions.** Next.js 15 (App Router), React 19, Prisma 6 + SQLite, Tailwind 3, Recharts 2, Zod 3, Mermaid 11. Pinned to stable major lines.
2. **UI components.** Small hand-written Tailwind components (`components/ui.tsx`) in the shadcn style instead of running the shadcn CLI. Fewer dependencies; same look.
3. **Mock LLM provider is the default.** With no API key the app uses rule-based drafts for every LLM task. The demo then runs offline and gives the same result every time. Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` for real Claude calls. The seed always uses the mock provider so demo data is repeatable.
4. **Anthropic call settings.** Default model `claude-opus-5-5` (configurable), `effort: low` for speed (target < 20 s per step), server-side refusal fallback enabled (`fallbacks: "default"`); if the API rejects that parameter the call is retried without it.
5. **Intake.** Fixed questions keep intake under 10 minutes and predictable; the LLM writes the final structured summary. The user always confirms and edits the summary.
6. **Embeddings.** Local hashed bag-of-words + bigram vectors (512 dims) with a small synonym list. No external embedding API needed. Thresholds: document match ≥ 0.28, routing capability ≥ 0.22, asset ≥ 0.24 (strong ≥ 0.34), cluster pre-selection ≥ 0.35.
7. **Routing.** Rules (`lib/routing/rules.ts`) always run. With an LLM, the LLM proposal is shown and the rule result is shown next to it when they differ. The pod analyst confirms.
8. **Occurrences per month are per person.** The time-saved formula multiplies by people count, so frequency in documents and forms is per person.
9. **Adoption ramp** applies to *Time saved* and *Fewer errors* only (as in the brief). Other levers count in full from year 1.
10. **EXCEEDS_SPEND** compares time-saved value with the annual cost of the people who really do the process: `processTeamFte × hours per FTE × average cost per hour`. The input is optional; without it the flag cannot fire.
11. **Payback** is the first month where cumulative benefit minus run cost covers the build cost (monthly granularity).
12. **Approval levels.** "High-risk flags" = ROI too high, exceeds spend, headcount implied. A small/R2 case with such flags goes to L2. L2 outcome: majority reject → rejected; any "more data" → more data; any POC → POC; else approved. L3: member votes are advisory, the chair's decision is final.
13. **L2 deadlines** are processed when someone opens the approvals inbox or clicks *Process overdue L2 reviews* (no background scheduler in the prototype).
14. **Council meetings**: first Thursday of each month, created on demand.
15. **Value actuals** are entered as annualized values and compared with the year-1 expected value (adoption-adjusted) of each lever.
16. **Finance data visibility.** Value and cost screens are visible to Finance, Council, Digital head, pod analysts and architects. Requesters see their own case; requesters see only their function's requests in the register.
17. **PDF export** uses a print-friendly page (*Print / PDF*) instead of a server-side PDF library.
18. **Reuse options** exclude embedded software features (those belong to route R1) and favour assets already used by the requester's function.
