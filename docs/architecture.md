# Architecture (prototype P0)

```
Browser ──► Next.js App Router (server components + server actions)
              │
              ├─ lib/services/*   orchestration per factory step (DB + AI tasks + engines)
              │     ├─ lib/ai/*          task logic, Zod schemas, rule-based fallbacks
              │     ├─ lib/llm/*         provider interface: Anthropic | Azure OpenAI | mock
              │     ├─ prompts/*.v1.md   versioned prompts
              │     ├─ lib/value/*       deterministic value engine (levers, calc, flags, Monte Carlo)
              │     ├─ lib/approval/*    approval levels, working days
              │     ├─ lib/routing/*     routing rules Q1–Q4
              │     └─ lib/similarity/*  embeddings + cosine (RAG over process documents)
              ├─ lib/export/*     .pptx (pptxgenjs), .docx (docx), .xlsx (exceljs)
              ├─ lib/notify/*     mock email → Outbox (Graph adapter in production)
              └─ lib/audit/*      AuditEvent + EditLog
              │
              ▼
           Prisma ──► SQLite (prototype) / PostgreSQL + pgvector (production)
```

## Key flows

- **LLM task** (`lib/llm/task.ts`): load `prompts/<task>.v1.md` → fill variables → provider → extract JSON → Zod validate → retry once with the validation error → fallback to rule-based draft. Metadata (prompt id, provider, duration, sizes, outcome) is logged as `AuditEvent` `LLM_CALL`; content is not logged.
- **Value** (`lib/services/value.ts`): DB rows → `ValueModel` → `computeValue` → `computeFlags` → optional `monteCarlo`. Nothing is stored; every screen recalculates, so numbers are always consistent with the latest inputs. The business case stores a snapshot of the numbers it used.
- **Approval** (`lib/services/workflow.ts`): determine level → optional Finance step → L1 (Head of Digital & AI) / L2 (Council members online, no reply by deadline = approved) / L3 (next Council meeting, chair decides) → decision log + emails.

## Data model

See `prisma/schema.prisma`. It follows section 5 of `CLAUDE.md`. SQLite has no lists, so list fields are JSON strings (`lib/json.ts`).

## Production path (P1–P3)

| Prototype | Production |
|---|---|
| Role switcher cookie | Microsoft Entra ID SSO, roles from Entra groups (`lib/session.ts` is the single seam) |
| SQLite | Azure Database for PostgreSQL + pgvector (change the Prisma provider) |
| Local hashed embeddings | Provider embeddings + pgvector / Databricks Vector Search (`lib/similarity/embeddings.ts`) |
| Mock email outbox | Microsoft Graph sendMail + Teams (`lib/notify/email.ts`) |
| Anthropic / mock | Azure OpenAI / AI Foundry in the client tenant (`lib/llm/azureOpenAI.ts`) |
| Seeded process documents | SharePoint / Databricks connectors feeding `indexDocument` |
| Manual actuals | Databricks SQL usage data for value tracking |
