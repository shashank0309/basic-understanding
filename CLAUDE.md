# AI Use-Case Factory — Build Context for Claude Code

> **How to use this file:** Put this file in the root of a new repository as `CLAUDE.md` (or reference it from `CLAUDE.md`). It gives Claude Code the full business context, scope, requirements, data model and build plan for the prototype and for the 6-month deliverable.
>
> **Confidentiality:** This repository must contain **synthetic data only**. Do not put real client documents, names of client employees, financial data or transcripts in the code, seed data or prompts.

---

## 1. Background

### 1.1 Client situation (summary)

The client is a large Indian pharmaceutical company (referred to in code as `CLIENT_NAME`, configurable). Its central Digital and AI team has approximately 25 persons (mostly data engineers on Azure and Databricks, some AI developers, 5–6 techno-functional business analysts).

In less than two years, the team built:
- An Azure + Databricks data lake ("enterprise brain") that joins SAP, CRM, budget and other data.
- A knowledge assistant that answers questions from enterprise documents with access control (used by HR and marketing; pilots in medical affairs and quality).
- An AI framework for quality (internal brand name — use `AI_FRAMEWORK_NAME`, configurable).
- Copilot Chat for ~47,000 employees; premium AI (Copilot, ChatGPT, Claude) for ~450 users.
- More than 1,000 user-built agents in Copilot Studio.
- Harmonized digital applications (for example, a material destruction approval application integrated with SAP).

### 1.2 The problem this application solves

Workshops with the business created a large number of use-case requests. The team cannot assess them all. Specific problems:

1. **No single intake.** Requests come through workshops, email and senior managers. The register is an Excel file.
2. **Duplicates.** Many requests are similar (for example, 10–12 SOP-related requests were one problem). Nobody groups them.
3. **Most requests are not "AI".** Many requests are better solved by embedded AI in current software, an extension of a current platform, a new digital application, or a report.
4. **ROI is not realistic.** ROI is often missing or too high (example: a ₹9 crore benefit claimed for a small calculator application).
5. **Slow decisions.** The AI Council has no fixed schedule. Priority goes to the most senior requester, not to the highest value.
6. **No value tracking.** Nobody checks if a solution gave the expected value after go-live.
7. **No reuse.** Good agents and solutions stay inside teams.

### 1.3 The solution

A web platform — the **AI Use-Case Factory** — that:

1. Lets business users submit a **business problem** (not an "AI use case").
2. Reads process documents and the asset catalogue, maps where AI helps, finds duplicates and reuse options, and asks the user to confirm.
3. Builds a **process simulation** (baseline vs. with-AI), calculates efficiency gain and business value with transparent, editable assumptions.
4. Generates a **business case** and **AI Council slides**, and starts an **approval workflow** with email notifications.
5. After approval, publishes reusable solutions (agents, skills, templates) to an **internal marketplace**, and **tracks value** after go-live.

### 1.4 Important design principles

- **The factory stops at the decision.** Build and implementation are out of scope. The platform hands over an approved specification.
- **Human in the loop at every step.** The AI drafts; people confirm. Mandatory human checkpoints: (a) business analyst after mapping, (b) Finance on high-value cases, (c) the AI Council.
- **The LLM never calculates numbers.** The LLM proposes inputs and explains them. Deterministic code calculates all values, totals, ROI and flags.
- **Every number has a source and a confidence level.** Show them in the UI.
- **Fast for the user.** Intake must take 15 minutes or less.
- **Routing before assessment.** Only custom AI requests get the full business case.
- **Simple language in the UI.** Use short sentences, active voice and common words (ASD-STE100 style, approximately 60%).

---

## 2. Users and roles

| Role | Description | Main actions |
|---|---|---|
| `REQUESTER` | Business user in a function | Submit a problem, answer questions, confirm process map, edit baseline inputs, view status |
| `POD_ANALYST` | Factory pod business analyst | Review sort-and-route result, merge duplicates, run assessment with the requester, prepare business case |
| `ARCHITECT` | Solution architect (technical team) | Add paper architecture, choose reused assets, enter cost estimate (TCO) |
| `FINANCE` | Finance partner | Approve value inputs and business cases above threshold |
| `ITBP` | Function IT business partner | Confirm if current software or its roadmap covers the request |
| `COUNCIL_MEMBER` | AI Council member | Review, comment, vote (approve / reject / POC / ask for data) |
| `COUNCIL_CHAIR` | AI Council chair (CIO) | Final decision for Level 3 |
| `DIGITAL_HEAD` | Head of Digital and AI | Approve Level 1 requests, see all dashboards |
| `ADMIN` | Platform admin | Manage value levers, benchmarks, thresholds, asset catalogue, users |

Prototype: a **role switcher** in the top bar (no real auth).
Production: Microsoft Entra ID SSO with role mapping from Entra groups.

---

## 3. End-to-end flow

```
1 Submit ─► 2 Sort & route ─► 3 Map & reuse ─► 4 Simulate & value ─► 5 Design & cost
                 │                                                        │
                 └─ Routes 1–4 exit to other teams (tracked)              ▼
                                         7 Track value ◄─ 6b Publish ◄─ 6 Business case & approval
```

### Step 1 — Submit (conversational intake)
- Chat-style intake. The agent asks short questions to collect:
  - Function, sub-function, site(s) / region
  - Problem statement in the user's words
  - Current process (steps, tools used — Excel, email, SAP, paper)
  - Who does the work, how often, how long
  - Pain points and the expected result
  - Data sources involved
  - Urgency and requester's sponsor
- The agent writes a **structured problem summary** and shows it to the user for confirmation/editing.
- Also provide a **classic form** as an alternative (some users prefer forms).
- Target: ≤ 15 minutes. Show a progress indicator.

### Step 2 — Sort and route
Run automatically after submission. Pod analyst reviews the result.

**2a. Duplicate and similarity check**
- Compute embeddings of the problem summary.
- Compare with all requests in the register (open, in progress, delivered) and with the asset catalogue.
- Show the top 5 similar items with similarity score and a one-line reason.
- Pod analyst can: merge into an existing request, link as related, or create a **cluster** (group of related requests solved by one solution).

**2b. Routing (ordered questions)**
The system proposes a route with reasons. The pod analyst confirms or changes it.

| Order | Question | If yes → Route |
|---|---|---|
| Q1 | Can an AI function in current enterprise software solve it? (check the software capability list + ITBP roadmap) | **R1 Embedded AI** → send to function ITBP |
| Q2 | Can a current platform, agent or solution solve it (with configuration or a small extension)? | **R2 Extend platform** → fast route: pilot in 1–2 weeks |
| Q3 | Is the current process on paper / Excel / email, so it must be digital first? | **R3 Build application** → send to application team |
| Q4 | Does the user only need data from systems or a report/dashboard? | **R4 Data or report** → send to data team |
| — | None of the above | **R5 Custom AI** → full assessment (steps 3–6) |

- Routes R1–R4 exit the full flow but **stay in the register** with status and owner (so the register is the single source of truth).
- R2 requests get a lightweight "fast route" record (pilot plan, owner, date) and can go straight to Level 1 approval.

### Step 3 — Process mapping and reuse
- The system reads **process documents** (SOPs, process descriptions, user uploads) through retrieval (RAG).
- Output:
  - A **process map**: ordered steps, actor, system, average time, frequency, pain points.
  - For each step: **AI opportunity** (none / assist / automate), the AI pattern (extraction, Q&A, classification, summarization, drafting, prediction, agentic workflow), and the reason.
  - **Reuse options** from the asset catalogue: "Use as-is", "Reuse as a skill/component", or "Build new". Each with fit score and reason.
- If no process document is found, the agent says so and **interviews the user** to build the map.
- The requester confirms or edits the map in a visual editor (list of steps; drag to reorder; edit fields).
- **Checkpoint:** pod analyst marks step 3 as "Aligned".

### Step 4 — Process simulation and value estimate
- **Baseline:** for each process step, the user enters (or confirms suggested) values: time per occurrence, occurrences per period, number of people, cost per hour (from role benchmarks), error rate, cost per error.
- **With-AI scenario:** the system proposes the change per step (for example, "time from 45 min to 10 min", "error rate from 4% to 1%") with a reason and a confidence level.
- **Simulation view:** side-by-side table and chart: baseline vs. with-AI per step, total cycle time, total effort hours, errors.
  - Optional: simple Monte Carlo (e.g., 1,000 runs) using low/likely/high ranges per input, to show a P10/P50/P90 range for value. (Prototype: optional; deliverable: required.)
- **Value levers** (see section 6) convert efficiency into ₹ value.
- **User edits:** every input is editable. Every edit is logged (old value, new value, user, reason).
- **Quality checks / flags** (see section 6.4) appear next to the numbers.
- **Checkpoint:** if value > Finance threshold, Finance must approve the inputs.

### Step 5 — Solution design and cost (TCO)
- Architect selects reused assets and adds components from a **component cost card** list (for example: LLM usage, vector store, Databricks compute, Copilot Studio messages, app hosting, licences, build effort in person-days, support FTE).
- The system proposes a **draft architecture description** (text + simple block diagram, e.g., Mermaid) based on the process map and reuse choices.
- The system calculates **5-year TCO** = build cost + 5 × annual run cost (configurable horizon 3 or 5 years).
- Governance pre-check: the system lists required reviews (security checklist type, GxP validation needed?, personal data?, external users?, data residency).

### Step 6 — Business case and approval
- The system generates a **business case** (structured document) with:
  - Problem, current process, proposed solution, reuse, value (with ranges and confidence), TCO, net value, payback, risks, governance reviews required, recommendation.
- The system generates **AI Council slides** (2–3 slides, .pptx) from a template.
- The system determines the **approval level** (section 7) and starts the **workflow**:
  - Email notifications to approvers (with link to the case).
  - Approvers see an inbox; they can approve, reject, approve as POC, or ask for more data, with comments.
  - Level 2: online review with deadline; no reply by deadline = approved (configurable).
  - Level 3: case goes to the agenda of the next Council meeting.
- All decisions go to a **decision log**, visible to the requester.

### Step 6b — Publish to marketplace
- After approval and delivery (status set manually by the delivery team in the prototype), the reusable outputs are published to the **marketplace**:
  - Item types: Agent, Skill / prompt pack, Template, Platform extension, Data product, Application.
  - Tiers: `PERSONAL`, `TEAM`, `CERTIFIED` (see section 8).
- Each item: owner, description, functions, how to use, target tool (Copilot / ChatGPT / Claude / custom app), version, review date, usage, rating, linked request.

### Step 7 — Value tracking
- At go-live + 3 months and + 6 months, the system asks the owner to enter actual values (or pulls usage data from connected sources in production).
- Compares **actual vs. expected** value per lever.
- Feeds results into **benchmarks** (section 6.3) to improve future estimates.
- Portfolio dashboard: expected vs. realized value across all approved use cases.

---

## 4. Screens

1. **Home / dashboard** (by role): my requests, my tasks, pipeline funnel (submitted → routed → assessed → decided → delivered → value tracked), backlog age.
2. **Submit a problem**: chat intake + form option + summary confirmation.
3. **Register**: table of all requests with filters (function, route, status, level, value, age), search, cluster view, export to Excel.
4. **Request detail** (tabs):
   - Overview (summary, status timeline, owner)
   - Similar & route
   - Process map & reuse
   - Simulation & value
   - Design & cost
   - Business case
   - Approvals & decision log
   - Value tracking
   - Audit trail
5. **Triage queue** (pod analyst): new requests with proposed route and duplicates.
6. **Approvals inbox** (Finance, Council, Digital Head).
7. **Council meeting view**: agenda of Level 3 cases, one-click slide pack download, decision capture.
8. **Marketplace**: search, filter by function/type/tier/tool, item page, "request access / use" button.
9. **Value dashboard**: expected vs. realized value, by function and lever; estimate accuracy over time.
10. **Admin**: value levers, benchmarks, role cost rates, component cost cards, approval thresholds, asset catalogue, software capability list, process document library, users and roles, email templates.

---

## 5. Data model (initial)

Use these entities. Names are suggestions.

```
Function { id, name, parentId?, region }
User { id, name, email, role[], functionId }

Request {
  id, code (e.g., UC-2026-0042), title, problemStatement, structuredSummary (JSON),
  functionId, sites[], requesterId, sponsor, urgency,
  status (DRAFT | SUBMITTED | ROUTED | IN_ASSESSMENT | ALIGNED | VALUED | DESIGNED |
          IN_APPROVAL | APPROVED | APPROVED_POC | REJECTED | MORE_DATA | IN_DELIVERY |
          LIVE | VALUE_TRACKED | CLOSED_EXITED),
  route (R1_EMBEDDED | R2_EXTEND | R3_APP | R4_DATA | R5_CUSTOM_AI)?,
  routeReason, clusterId?, mergedIntoId?, ownerId (pod analyst),
  createdAt, updatedAt
}
Cluster { id, name, description, requestIds[] }
SimilarityLink { requestId, targetType (REQUEST|ASSET), targetId, score, reason }

Asset {
  id, name, type (PLATFORM | AGENT | SKILL | TEMPLATE | DATA_PRODUCT | APPLICATION | EMBEDDED_FEATURE),
  description, capabilities[], dataSources[], functionsUsing[], ownerId, maturity
  (PILOT | LIVE | CERTIFIED), targetTool, embedding
}
SoftwareCapability { id, software (e.g., SuccessFactors, SAP, CRM, LIMS), feature, available (NOW|ROADMAP), roadmapDate?, notes }
ProcessDocument { id, title, functionId, type (SOP | PROCESS_DESC | UPLOAD), content, chunks[] (with embeddings), version }

ProcessMap { id, requestId, steps: ProcessStep[] , confirmedBy?, confirmedAt? }
ProcessStep {
  order, name, actor, system, minutesPerOccurrence, occurrencesPerMonth, peopleCount,
  errorRatePct?, costPerError?, painPoints[],
  aiOpportunity (NONE|ASSIST|AUTOMATE), aiPattern?, aiReason?,
  withAi: { minutesPerOccurrence, errorRatePct, reason, confidence }
}
ReuseOption { requestId, assetId, mode (AS_IS | AS_SKILL | BUILD_NEW), fitScore, reason, selected }

ValueInput {
  id, requestId, leverId, key, value, low?, high?, unit,
  source (USER | BENCHMARK | SYSTEM_DATA | FINANCE), sourceNote, confidence (HIGH|MEDIUM|LOW)
}
ValueResult { requestId, leverId, annualValue, p10?, p50?, p90?, flags[] }
EditLog { entity, entityId, field, oldValue, newValue, userId, reason, at }

CostItem { requestId, componentId, quantity, unitCost, oneTime(bool), annual(bool), note }
ComponentCostCard { id, name, unit, unitCostINR, category, notes }
TcoResult { requestId, buildCost, annualRunCost, horizonYears, tco }

BusinessCase { requestId, version, content (JSON/Markdown), netValue, paybackMonths, recommendation, generatedAt }
Approval {
  id, requestId, level (L1|L2|L3), approverId, status (PENDING|APPROVED|REJECTED|POC|MORE_DATA),
  comment, dueAt, decidedAt
}
CouncilMeeting { id, date, agendaRequestIds[], minutes }
Decision { requestId, outcome, decidedBy, date, conditions }

MarketplaceItem {
  id, assetId, tier (PERSONAL|TEAM|CERTIFIED), owner, version, reviewDate,
  howToUse, targetTool, usageCount, rating, linkedRequestId
}
ValueActual { requestId, leverId, period (M3|M6|M12), actualValue, note, enteredBy }

ValueLever, Benchmark, RoleCostRate, ApprovalThreshold  (see sections 6–7)
Notification { id, userId, type, payload, sentAt, channel (EMAIL|IN_APP) }
AuditEvent { id, userId, action, entity, entityId, at, details }
```

---

## 6. Value framework

### 6.1 Value levers (configurable in Admin)

| Lever key | Name | Formula (annual) |
|---|---|---|
| `TIME_SAVED` | Time saved | Σ steps (baselineMin − withAiMin) / 60 × occurrencesPerMonth × 12 × peopleCount × costPerHour × adoptionRate × realizationFactor |
| `ERRORS_AVOIDED` | Fewer errors / deviations | Σ steps occurrences/yr × (baselineErr% − withAiErr%) × costPerError × adoptionRate |
| `COMPLIANCE_RISK` | Audit / compliance risk avoided | auditObservationsAvoidedPerYear × costPerObservation × probabilityFactor |
| `REVENUE_UPLIFT` | Revenue increase | additionalSales × marginPct × attributionFactor |
| `COST_AVOIDED` | Cost avoided | licences / external services / materials not purchased per year |
| `CYCLE_TIME` | Faster cycle time (working capital or time-to-market) | daysReduced × valuePerDay (Finance-defined) |

Default factors (editable, demo values):
- `adoptionRate`: year 1 = 40%, year 2 = 70%, year 3+ = 85%
- `realizationFactor` for time saved: 0.5 (time saved is money only when capacity or cost really changes) — the UI must explain this.
- Discount rate for NPV (optional): 10%.

### 6.2 Calculations (deterministic code, unit-tested)
- Annual value per lever, per year (with adoption ramp).
- 5-year benefit (or 3-year, configurable).
- Net value = total benefit − TCO.
- Payback month.
- ROI multiple = total benefit / TCO.
- Optional Monte Carlo with triangular distributions (low / likely / high) → P10 / P50 / P90.

### 6.3 Benchmarks
- Table of benchmark ranges per lever and per AI pattern, e.g., "Document drafting with AI assist: 30–60% time reduction"; "Q&A over documents: 50–80% reduction in search time".
- Role cost rates (₹ per hour) per role band (synthetic demo values).
- After value tracking, actual results update benchmark statistics (show "estimate accuracy" per pattern).

### 6.4 Quality checks / flags (show as warnings next to values)
- `OUT_OF_RANGE`: a with-AI reduction is outside the benchmark range for that AI pattern.
- `ROI_TOO_HIGH`: ROI multiple > 10× (configurable).
- `EXCEEDS_SPEND`: time-saved value > total annual cost of the people doing that process.
- `LOW_CONFIDENCE_MAJORITY`: > 50% of value comes from inputs with LOW confidence.
- `NO_SOURCE`: an input has no source note.
- `HEADCOUNT_IMPLIED`: time saved implies > 1 FTE per team but realization factor is 1.0.
Flags do not block, but a flagged case needs a written justification before approval.

---

## 7. Approval levels (configurable; demo values)

| Level | Rule | Approvers | Mode |
|---|---|---|---|
| L1 | Route R2 (reuse) OR TCO < ₹25 lakh, and no high-risk flags | Digital Head | Online, due in 3 working days |
| L2 | TCO ₹25 lakh – ₹1 crore | Council members (online) | Due in 5 working days; no reply = approved (configurable) |
| L3 | TCO > ₹1 crore OR high risk (GxP process, patient/personal data, external users) | Full AI Council, chair decides | Next scheduled monthly meeting |

Finance approval is an extra step before the level approval when total 5-year benefit > ₹50 lakh (configurable).

---

## 8. Marketplace tiers

| Tier | Who can use | Requirements |
|---|---|---|
| PERSONAL | Builder only | Basic usage rules accepted |
| TEAM | One team or function | Owner, description, data check |
| CERTIFIED | All employees | Owner, version, security check, support model, value data, review date |

Items past their review date show a warning and drop from search ranking.

---

## 9. AI components (LLM tasks)

All LLM calls go through one **provider interface** (`lib/llm/`), so the platform can use:
- Anthropic Claude API (default for the prototype), and
- Azure OpenAI / Azure AI Foundry models (production on the client's Azure tenant; check model availability and data residency in the client's region).

Every LLM task must:
- Use a versioned prompt file (`prompts/<task>.v1.md`).
- Return **JSON validated by a schema** (Zod). Retry once on invalid output, then fall back to manual entry.
- Include citations (document id + chunk) when it uses retrieved content.
- Log input/output metadata (not full content in production) for audit.

| Task | Input | Output (JSON) |
|---|---|---|
| `intake_agent` | Conversation so far | Next question OR final `structuredSummary` |
| `route_proposal` | Summary, top similar items, software capability list, asset catalogue | `{ route, answers: {q1..q4: {answer, reason, evidence[]}}, confidence }` |
| `similarity_reason` | Two items | One-line reason |
| `process_mapper` | Summary + retrieved process chunks | `{ steps[], sourceDocs[], gaps[] }` |
| `ai_opportunity` | Process steps | Per step `{ aiOpportunity, aiPattern, withAi{...}, reason, confidence }` |
| `reuse_matcher` | Process map + asset catalogue | `ReuseOption[]` |
| `architecture_draft` | Map, reuse, components | Text + Mermaid diagram |
| `business_case_writer` | All structured data + calculated results | Business case sections (Markdown). It must use only the calculated numbers given. |
| `slide_writer` | Business case | Content for 3 slides (title, bullets, key numbers) |

Embeddings: provider embeddings (or a local model) stored with the record. Prototype: cosine similarity in application code. Production: pgvector or Databricks Vector Search.

---

## 10. Technology stack

### 10.1 Prototype (client showcase)
- **Next.js (App Router) + TypeScript**
- **Tailwind CSS + shadcn/ui**; charts with Recharts
- **Prisma + SQLite** (single-file DB, easy demo); switchable to Postgres
- **LLM:** provider interface; Anthropic SDK default; env var to switch
- **Embeddings:** provider embeddings; cosine in code
- **Slides:** `pptxgenjs` with a neutral template (configurable logo/colours)
- **Business case export:** Markdown → DOCX (`docx` npm) and PDF
- **Email:** mock email service that writes to an in-app "Outbox" page (and optionally Mailpit/SMTP)
- **Auth:** role switcher (no real auth)
- **Mermaid** for architecture diagrams in the UI

### 10.2 Production target (6-month deliverable) — align with client stack
- Hosting: Azure App Service or Azure Container Apps, in the client tenant
- Database: Azure Database for PostgreSQL (+ pgvector) — or Dataverse if the client requires Power Platform
- Auth: Microsoft Entra ID SSO, role mapping from groups
- LLM: Azure OpenAI / Azure AI Foundry (client choice); provider interface stays
- Documents: SharePoint / Databricks for process documents and the asset catalogue (connectors)
- Data for value tracking: Databricks SQL (usage logs, SuccessFactors, AD joins)
- Email and workflow: Microsoft Graph (email) and/or Power Automate approvals; Teams notifications
- Monitoring: Application Insights
- Security: client IT security review checklist; RBAC; audit log; data residency in India region; no training on client data

---

## 11. Seed data (synthetic — required for the demo)

Create `prisma/seed.ts` with realistic but **fictional** data.

### 11.1 Functions
R&D, Manufacturing, Quality, Commercial – India, Commercial – Branded (US), Medical Affairs, Supply Chain, Regulatory, HR, Finance, Procurement, Legal.

### 11.2 Assets (catalogue)
1. Enterprise Knowledge Assistant — PLATFORM — document Q&A with access control — LIVE (HR, Marketing), PILOT (Medical Affairs, Quality)
2. Quality AI Agent — AGENT — chat over quality structured + unstructured data — LIVE (Quality)
3. Enterprise Data Lake / Genie query — DATA_PRODUCT — natural-language queries over SAP, budget, GRN data — PILOT (Finance)
4. Material Destruction Approval App — APPLICATION — SAP-integrated approvals — LIVE (India sites)
5. CRM Support FAQ Agent — AGENT — step-by-step answers for CRM how-to questions — PILOT (one division)
6. Quality Document Writing Assistant — AGENT (Copilot Studio) — checks quality documents against writing guidelines — TEAM
7. Printing Analytics Dashboard — DATA_PRODUCT — printing trend by site and department — LIVE
8. SuccessFactors AI writing assist — EMBEDDED_FEATURE — goal and comment writing — LIVE
9. Mid-year review summary prompt pack — SKILL — TEAM

### 11.3 Software capability list
SuccessFactors (AI writing assist: NOW), SAP (Joule features: ROADMAP), CRM (call notes summary: ROADMAP Q2), LIMS (new version rollout: NOW), TrackWise (AI classification: ROADMAP).

### 11.4 Process documents (write short synthetic texts, 300–800 words each)
- SOP: Writing and review of standard operating procedures
- SOP: Batch changeover and cleaning
- Process: Medical query handling from field representatives
- Process: Monthly sales effort vs. sales review (commercial)
- Process: Purchase price variance review (finance)
- Process: Market research article management

### 11.5 Requests (25–30), designed to show every route and feature
- **SOP cluster (to show duplicates → cluster):** "Check SOP drafts against format", "Find gaps vs. global SOP", "Simplify SOP language", "Harmonize SOPs across sites", "SOP change impact summary" … (8–12 similar requests from different sites)
- **R1 Embedded:** "Help managers write better review comments" → SuccessFactors AI
- **R2 Extend:** "Search our market research articles" → Knowledge Assistant; "Answer CRM how-to questions for new reps" → CRM FAQ Agent
- **R3 Application:** "Quality deviation log maintained in Excel across sites"
- **R4 Data/report:** "See CRM effort and sales data together"
- **R5 Custom AI:** "Alert sales managers when field effort falls and distributor orders drop"; "Medical query assistant for field reps over approved literature"; "Predict material destruction for next 6 months to adjust procurement"
- **Inflated ROI example (to show flags):** "Pricing calculator app" with requester-claimed ₹9 crore annual benefit → triggers `ROI_TOO_HIGH`, `EXCEEDS_SPEND`
- Requests in every status, including 2 LIVE with value-tracking actuals (one above, one below expectation).

### 11.6 Benchmarks, role cost rates, cost cards
Synthetic ₹ values; label in UI as "Demo values".

---

## 12. Repository structure (suggested)

```
/app                 Next.js routes (dashboard, submit, register, requests/[id], approvals, council, marketplace, value, admin, outbox)
/components          UI components (shadcn)
/lib
  /llm               provider interface, anthropic.ts, azureOpenAI.ts
  /prompts           loader for /prompts files
  /value             levers.ts, calc.ts, montecarlo.ts, flags.ts   (pure functions, unit-tested)
  /routing           routing.ts (rules + LLM proposal merge)
  /similarity        embeddings.ts, cosine.ts
  /approval          levels.ts, workflow.ts
  /export            pptx.ts, docx.ts, pdf.ts
  /notify            email.ts (mock + Graph adapter)
  /audit             audit.ts
/prompts             *.v1.md prompt files
/prisma              schema.prisma, seed.ts
/tests               unit tests (value engine, flags, levels, routing rules), e2e (Playwright) for demo script
/docs                architecture.md, demo-script.md, decisions.md
```

---

## 13. Build plan

### Phase P0 — Showcase prototype (target: 2–3 weeks)
Goal: a clickable, working demo with real LLM calls on synthetic data.

1. Scaffold project, DB schema, seed data, role switcher, layout.
2. Register + request detail (read-only on seeded data).
3. Conversational intake → structured summary → save.
4. Similarity check + route proposal + pod confirm + cluster creation.
5. Process mapping from seeded documents + AI opportunity + reuse options + user edit.
6. Simulation & value: baseline vs. with-AI table + chart, levers, flags, edit log.
7. Design & cost: cost cards → TCO; Mermaid architecture draft.
8. Business case generation + .pptx Council slides download.
9. Approval workflow with levels, approvals inbox, mock email outbox, decision log.
10. Marketplace (seeded items + publish from an approved request).
11. Value dashboard with seeded actuals.
12. Demo script (`docs/demo-script.md`) and a "Reset demo data" button.

**P0 acceptance criteria**
- A new request goes from submission to Council decision in the demo in < 10 minutes.
- The inflated-ROI request shows flags clearly.
- The SOP requests group into one cluster.
- Every number on the value screen shows source + confidence; every edit is in the audit trail.
- Slides download and open in PowerPoint.
- No real client data anywhere.

### Phase P1 — Pilot-ready (months 1–3 of the engagement)
- Entra ID SSO and RBAC; Postgres; deploy to client Azure (dev/test).
- Admin screens for levers, benchmarks, thresholds, catalogue, capability list.
- Document library connector (SharePoint) for process documents.
- Real email (Graph) + Teams notifications.
- Import the client's current Excel register.
- Security review and data residency checks with client IT security.

### Phase P2 — AI-assisted factory in production use (months 4–5)
- Monte Carlo ranges; benchmark learning from actuals.
- Power Automate or native approvals integration.
- Council meeting view with agenda and minutes.
- Marketplace tiers and certification workflow.
- Value tracking reminders at M3/M6.

### Phase P3 — Handover deliverable (month 6)
- Hardening: tests, accessibility, performance, error handling.
- Usage analytics dashboard connection (Databricks).
- Documentation: user guide, admin guide, architecture, runbook, prompt catalogue, data model.
- Training sessions and handover to the client team.

**Month-6 deliverable checklist**
- [ ] Production deployment in client Azure tenant
- [ ] SSO, RBAC, audit log, data residency confirmed
- [ ] All 7 steps working end to end with client data
- [ ] Current register imported; backlog routed
- [ ] Value framework configured and approved by Finance
- [ ] Approval levels configured and approved by the AI Council
- [ ] Marketplace live with certified items
- [ ] Value tracking active for live use cases
- [ ] Documentation and training complete
- [ ] Security review passed

---

## 14. Non-functional requirements

- **Security:** RBAC on every API route; requesters see only their function's requests unless granted; Finance data visible only to FINANCE/COUNCIL/ADMIN.
- **Audit:** log every create/update/decision with user and time.
- **Privacy:** no personal data in prompts except the minimum (names → user IDs).
- **Regulated processes:** if a request touches a GxP process, flag "Computer system validation (CSV/CSA) required" in the governance pre-check.
- **Explainability:** every AI suggestion shows its reason and sources.
- **Performance:** each LLM step < 20 seconds with a visible progress state; never block the UI.
- **Accessibility:** WCAG 2.1 AA basics (keyboard, contrast, labels).
- **Configurability:** client name, logo, colours, currency (₹, lakh/crore formatting), thresholds — no hard-coding.

---

## 15. Demo script (for the client showcase, ~15 minutes)

1. **Dashboard** — show the backlog and funnel. "Today this is an Excel file."
2. **Submit** — a quality manager submits "Our SOP reviews take too long" through the chat. Summary appears in 3 minutes.
3. **Sort and route** — the system finds 10 similar SOP requests from other sites. The analyst creates one cluster. Route = Custom AI, with reuse of the Knowledge Assistant.
4. **Fast route example** — open "Search market research articles": routed to R2, Level 1, pilot next week.
5. **Process map** — map built from the SOP document, with citations. AI opportunity per step.
6. **Simulation** — baseline vs. with-AI; value with ranges and confidence. Change one input; value updates; edit is logged.
7. **Flags** — open the "Pricing calculator" request: ₹9 crore claim flagged as unrealistic.
8. **Design & cost** — reuse lowers TCO; net value and payback shown.
9. **Business case & slides** — generate and download the Council pack.
10. **Approval** — Level 3 because GxP; email in the outbox; Council member approves as POC.
11. **Marketplace** — published skill/agent with tier and usage.
12. **Value dashboard** — expected vs. actual for live use cases; estimate accuracy.

---

## 16. Instructions for Claude Code

- Work in the phases and steps in section 13. After each step, run tests and the dev server, and update `docs/decisions.md` with key decisions.
- Write unit tests for all of `/lib/value`, `/lib/approval/levels.ts`, and routing rules **before** UI work on those screens.
- Keep LLM prompts in `/prompts`, versioned. Never put numbers calculated by the LLM into the business case; pass calculated values in.
- Use Zod schemas for every LLM output and API input.
- Use only synthetic seed data. Add a banner "Demo – synthetic data" in P0.
- UI text: short sentences, active voice, common words.
- Keep components small; prefer server actions for mutations; keep business logic out of React components.
- Make the LLM provider, thresholds, levers, branding and currency configurable via env/Admin.
- When a requirement is unclear, choose the simplest option that keeps the demo script working, and record the choice in `docs/decisions.md`.
