// Synthetic requests that show every route, status and feature of the demo.
import { db } from "../db";
import { str } from "../json";
import type { Summary } from "../ai/schemas";
import { embed } from "../similarity/embeddings";
import { addWorkingDays } from "../approval/levels";
import { bandFor, generateMap, generateReuse } from "../services/mapping";
import { proposeRoute, refreshSimilarity, requestText } from "../services/triage";
import { draftArchitecture } from "../services/design";
import { ensureGeneralInputs, loadValue } from "../services/value";
import { generateBusinessCase } from "../services/businessCase";
import { createLevelApprovals, nextCouncilMeeting } from "../services/workflow";
import { DOC_MATCH_MIN } from "../services/mapping";

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

let counter = 0;
const code = () => `UC-2026-${String(++counter).padStart(4, "0")}`;

interface Spec {
  title: string;
  problem: string;
  fn: string;
  sites: string[];
  requester: string;
  sponsor?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH";
  status: string;
  route?: string;
  routeReason?: string;
  daysAgo: number;
  gxp?: boolean;
  personalData?: boolean;
  summary?: Partial<Summary>;
  exitTeam?: string;
  owner?: string;
}

async function createReq(s: Spec) {
  const summary: Partial<Summary> = { title: s.title, problem: s.problem, sites: s.sites, urgency: s.urgency ?? "MEDIUM", sponsor: s.sponsor ?? "", gxp: !!s.gxp, ...s.summary };
  const r = await db.request.create({
    data: {
      code: code(), title: s.title, problemStatement: s.problem, summary: str(summary), functionId: s.fn, sites: str(s.sites),
      requesterId: s.requester, sponsor: s.sponsor ?? "", urgency: s.urgency ?? "MEDIUM", status: s.status, route: s.route ?? null,
      proposedRoute: s.route ?? null, routeReason: s.routeReason ?? "", routeSource: s.route ? "Pod analyst" : "", exitTeam: s.exitTeam ?? "",
      gxp: !!s.gxp, personalData: !!s.personalData, ownerId: s.owner ?? (s.status === "DRAFT" ? null : "u-pod1"),
      createdAt: new Date(Date.now() - s.daysAgo * DAY),
    },
  });
  await db.request.update({ where: { id: r.id }, data: { embedding: str(embed(requestText(r))) } });
  return r;
}

type StepSpec = [name: string, actor: string, system: string, min: number, occ: number, people: number, opp: "NONE" | "ASSIST" | "AUTOMATE", pattern: string | null, aiMin: number, err?: number, aiErr?: number, costPerError?: number];

async function addSteps(requestId: string, steps: StepSpec[], overrides: Record<number, Record<string, unknown>> = {}) {
  const rates = await db.roleCostRate.findMany();
  for (const [i, [name, actor, system, min, occ, people, opp, pattern, aiMin, err = 2, aiErr = 1, cpe = 5000]] of steps.entries()) {
    const band = bandFor(actor);
    const meta = {
      minutesPerOccurrence: { source: "USER", note: "Confirmed in assessment workshop", confidence: "MEDIUM" },
      occurrencesPerMonth: { source: "SYSTEM_DATA", note: "From system logs (synthetic)", confidence: "HIGH" },
      peopleCount: { source: "SYSTEM_DATA", note: "From HR org data (synthetic)", confidence: "HIGH" },
      costPerHour: { source: "BENCHMARK", note: `Role cost rate: ${band} (demo value)`, confidence: "HIGH" },
      errorRatePct: { source: "USER", note: "Requester estimate", confidence: "LOW" },
      costPerError: { source: "BENCHMARK", note: "Average rework cost (demo value)", confidence: "LOW" },
      aiMinutes: { source: "BENCHMARK", note: pattern ? `Benchmark for ${pattern.toLowerCase()}` : "No change", confidence: "MEDIUM" },
      aiErrorRatePct: { source: "BENCHMARK", note: "Benchmark", confidence: "MEDIUM" },
    };
    await db.processStep.create({
      data: {
        requestId, order: i + 1, name, actor, system, minutesPerOccurrence: min, occurrencesPerMonth: occ, peopleCount: people,
        costPerHour: rates.find((r) => r.band === band)?.ratePerHour ?? 900, errorRatePct: err, costPerError: cpe,
        aiOpportunity: opp, aiPattern: pattern, aiReason: pattern ? `${pattern[0]}${pattern.slice(1).toLowerCase()} pattern; inside benchmark range.` : "A person must act here.",
        aiMinutes: aiMin, aiErrorRatePct: opp === "NONE" ? err : aiErr, aiConfidence: "MEDIUM", meta: str(meta), ...(overrides[i] ?? {}),
      },
    });
  }
}

type InputSpec = [lever: string, key: string, label: string, value: number, source: string, note: string, confidence: string, low?: number, high?: number];
async function addInputs(requestId: string, inputs: InputSpec[]) {
  await ensureGeneralInputs(requestId);
  for (const [leverKey, key, label, value, source, sourceNote, confidence, low, high] of inputs) {
    await db.valueInput.upsert({
      where: { requestId_leverKey_key: { requestId, leverKey, key } },
      update: { value, source, sourceNote, confidence, label, low, high },
      create: { requestId, leverKey, key, label, value, source, sourceNote, confidence, low, high },
    });
  }
}

async function addCosts(requestId: string, items: [string, number, string?][]) {
  const cards = await db.componentCostCard.findMany();
  for (const [componentId, quantity, note] of items) {
    const c = cards.find((x) => x.id === componentId)!;
    await db.costItem.create({ data: { requestId, componentId, quantity, unitCost: c.unitCostINR, oneTime: c.kind === "ONE_TIME", note: note ?? "" } });
  }
}

async function aligned(id: string, daysAgo: number) {
  await db.request.update({ where: { id }, data: { mapAlignedAt: ago(daysAgo), mapAlignedBy: "u-pod1" } });
}

async function selectReuse(id: string, assetIds: string[]) {
  await generateReuse(id);
  for (const assetId of assetIds) {
    const ex = await db.reuseOption.findFirst({ where: { requestId: id, assetId } });
    if (ex) await db.reuseOption.update({ where: { id: ex.id }, data: { selected: true, mode: ex.mode === "BUILD_NEW" ? "AS_SKILL" : ex.mode } });
    else await db.reuseOption.create({ data: { requestId: id, assetId, mode: "AS_SKILL", fitScore: 0.6, reason: "Selected by the architect.", selected: true } });
  }
  await db.reuseOption.updateMany({ where: { requestId: id, assetId: { notIn: assetIds } }, data: { selected: false } });
}

async function decision(id: string, outcome: string, by: string, conditions: string, daysAgo: number) {
  await db.decision.create({ data: { requestId: id, outcome, decidedById: by, conditions, at: ago(daysAgo) } });
}

async function approval(requestId: string, level: string, approverId: string, status: string, comment: string, daysAgo: number, stage = "LEVEL", dueDays = 3) {
  await db.approval.create({ data: { requestId, level, stage, approverId, status, comment, createdAt: ago(daysAgo + 3), dueAt: ago(daysAgo - dueDays), decidedAt: status === "PENDING" ? null : ago(daysAgo) } });
}

async function finishCase(id: string) {
  await draftArchitecture(id);
  await generateBusinessCase(id);
}

async function actuals(id: string, factor: [number, number], note: [string, string]) {
  const v = await loadValue(id);
  for (const l of v.result.levers) {
    const expected = l.byYear[0];
    await db.valueActual.create({ data: { requestId: id, leverKey: l.key, period: "M3", expected, actualValue: Math.round(expected * factor[0]), note: note[0], enteredById: "u-pod1", at: ago(120) } });
    await db.valueActual.create({ data: { requestId: id, leverKey: l.key, period: "M6", expected, actualValue: Math.round(expected * factor[1]), note: note[1], enteredById: "u-pod1", at: ago(30) } });
  }
}

const SOP_REQUESTS: [string, string, string][] = [
  ["Check SOP drafts against format", "SOP drafts often break the template and writing guideline. QA reviewers spend most review time on format comments.", "Goa"],
  ["Find gaps vs. global SOP", "Our local SOPs drift from the global SOP. Reviewers compare them by hand and miss gaps that auditors find later.", "Baddi"],
  ["Simplify SOP language", "Operators find our SOPs hard to read. Long sentences cause mistakes on the shop floor. We want simpler SOP language.", "Sikkim"],
  ["Harmonize SOPs across sites", "Each site writes the same SOP differently. We want to harmonize SOPs across sites and keep them aligned with the global SOP.", "Indore"],
  ["SOP change impact summary", "When an SOP changes, authors write the change summary and training impact by hand. Summaries are often incomplete.", "Vizag"],
  ["Auto-check SOP template compliance", "Authors miss template rules in SOP drafts. Review takes two or three rounds because of format errors.", "Dahej"],
  ["Speed up SOP review cycle", "SOP review takes more than a month. QA reviewers check format and compare with the global SOP by hand.", "Pithampur"],
  ["Compare local SOP with corporate SOP", "We must compare each local SOP with the corporate SOP before approval. It takes hours to find the differences.", "Aurangabad"],
  ["SOP training impact assessment", "After an SOP revision we must decide who needs training. The SOP author writes the training impact by hand.", "Nagpur"],
  ["Reduce SOP review comments on format", "Most QA review comments on SOP drafts are about format, not content. We want drafts checked before review.", "Halol"],
];

export async function seedRequests() {
  counter = 0;
  // ── SOP duplicates: waiting in the triage queue (the analyst creates the cluster in the demo).
  for (const [i, [title, problem, site]] of SOP_REQUESTS.entries()) {
    await createReq({ title, problem, fn: "quality", sites: [site], requester: "u-req-quality", sponsor: `Site QA head, ${site}`, status: "SUBMITTED", daysAgo: 70 - i * 6, gxp: true, owner: "u-pod1",
      summary: { function: "Quality", subFunction: "QA documentation", currentProcess: ["Author drafts SOP", "QA reviewer reviews format and content", "Reviewer compares with global SOP", "Author updates draft", "QA head approves"], tools: ["Word", "Email", "SharePoint"], dataSources: ["SOP library", "Global SOPs", "Writing guideline"] } });
  }

  // ── R1 Embedded AI → exit to ITBP
  await createReq({ title: "Help managers write better review comments", problem: "Managers write weak performance review comments. HR wants clearer, fair comments in SuccessFactors.", fn: "hr", sites: ["All India"], requester: "u-req-hr", status: "CLOSED_EXITED", route: "R1_EMBEDDED", routeReason: "SuccessFactors AI writing assist is licensed and available now. Enable it for HR.", exitTeam: "Function IT business partner (ITBP)", owner: "u-itbp", daysAgo: 95 });

  // ── R2 fast route, waiting for L1 approval
  const mr = await createReq({ title: "Search our market research articles", problem: "Brand teams cannot search the content of market research articles in shared folders. They buy the same report twice.", fn: "commercial-india", sites: ["Mumbai HQ"], requester: "u-req-comm", sponsor: "Head of Marketing", status: "IN_APPROVAL", route: "R2_EXTEND", routeReason: "The Enterprise Knowledge Assistant can index the market research folders with access control.", daysAgo: 12 });
  await db.request.update({ where: { id: mr.id }, data: { fastRoute: str({ pilotPlan: "Index the 3 market research folders in the Knowledge Assistant. 20 brand managers test for 2 weeks.", owner: "Neha Gupta (pod)", date: ahead(7).toISOString().slice(0, 10) }), approvalLevel: "L1" } });
  await addInputs(mr.id, [["COST_AVOIDED", "annualCostAvoided", "Duplicate report purchases avoided", 1200000, "USER", "Brand team estimate: 4 duplicate reports per year", "LOW", 600000, 1800000]]);
  await addCosts(mr.id, [["build", 4, "Configure index and access groups"], ["llm", 100, "Share of Knowledge Assistant usage"], ["lic", 20, "Premium AI seats for brand managers"]]);
  await selectReuse(mr.id, ["A-EKA"]);
  await generateBusinessCase(mr.id);
  await approval(mr.id, "L1", "u-head", "PENDING", "", 1, "LEVEL", -2);

  // ── R2 approved, in delivery
  const crm = await createReq({ title: "Answer CRM how-to questions for new reps", problem: "New field reps call the CRM helpdesk for simple how-to questions. The helpdesk is overloaded in the first month after joining.", fn: "commercial-india", sites: ["All India"], requester: "u-req-comm", status: "IN_DELIVERY", route: "R2_EXTEND", routeReason: "The CRM Support FAQ Agent (pilot) answers CRM how-to questions. Extend it to all divisions.", daysAgo: 60 });
  await db.request.update({ where: { id: crm.id }, data: { fastRoute: str({ pilotPlan: "Roll out the CRM FAQ agent to two more divisions.", owner: "Arjun Sharma (pod)", date: ago(30).toISOString().slice(0, 10) }), approvalLevel: "L1" } });
  await addInputs(crm.id, [["COST_AVOIDED", "annualCostAvoided", "Helpdesk tickets avoided", 800000, "SYSTEM_DATA", "Helpdesk ticket data: 2,600 how-to tickets/yr × ₹310", "MEDIUM"]]);
  await addCosts(crm.id, [["cs", 1, "One message pack"], ["build", 5, "Extend knowledge base"]]);
  await selectReuse(crm.id, ["A-CRMFAQ"]);
  await generateBusinessCase(crm.id);
  await approval(crm.id, "L1", "u-head", "APPROVED", "Go. Track ticket volume.", 45);
  await decision(crm.id, "APPROVED", "u-head", "Go. Track ticket volume.", 45);

  // ── R3 / R4 exits
  await createReq({ title: "Quality deviation log maintained in Excel across sites", problem: "Each site keeps the deviation log in an Excel file and sends it by email each month. We need one digital log.", fn: "quality", sites: ["Goa", "Baddi", "Sikkim"], requester: "u-req-quality", status: "CLOSED_EXITED", route: "R3_APP", routeReason: "The process runs on Excel and email. It must become a digital application first.", exitTeam: "Application team", daysAgo: 80, gxp: true });
  await createReq({ title: "See CRM effort and sales data together", problem: "Sales managers want to see CRM call effort and secondary sales data together by territory.", fn: "commercial-india", sites: ["All India"], requester: "u-req-comm", status: "CLOSED_EXITED", route: "R4_DATA", routeReason: "The user needs a report that joins CRM and sales data. The data team can build it in the data lake.", exitTeam: "Data team", daysAgo: 85 });

  // ── R5: sales alerts (designed, ready to submit) — map from document
  const alert = await createReq({ title: "Alert sales managers when field effort falls and distributor orders drop", problem: "Managers find drops in field effort and distributor orders four to six weeks late. We want early alerts and suggested actions.", fn: "commercial-india", sites: ["All India"], requester: "u-req-comm", sponsor: "VP Sales India", urgency: "HIGH", status: "DESIGNED", route: "R5_CUSTOM_AI", routeReason: "No current asset predicts drops and suggests actions. Needs custom AI.", daysAgo: 40 });
  await generateMap(alert.id, "u-pod1");
  await aligned(alert.id, 25);
  await addInputs(alert.id, [
    ["REVENUE_UPLIFT", "additionalSales", "Sales recovered in weak territories", 40000000, "USER", "Commercial excellence estimate: 1% of sales in flagged territories", "LOW", 20000000, 60000000],
    ["REVENUE_UPLIFT", "marginPct", "Contribution margin", 35, "FINANCE", "FY26 contribution margin (synthetic)", "HIGH"],
    ["REVENUE_UPLIFT", "attributionFactor", "Share we can link to the alerts", 0.3, "USER", "Pod assumption; test in pilot", "LOW", 0.15, 0.4],
  ]);
  await addCosts(alert.id, [["build", 60], ["integ", 2, "CRM + distributor feed"], ["dbx", 8000], ["llm", 200], ["host", 1], ["support", 0.2]]);
  await selectReuse(alert.id, ["A-GENIE"]);
  await draftArchitecture(alert.id);

  // ── R5: medical query assistant — L3, on the next Council agenda (Finance already approved)
  const med = await createReq({ title: "Medical query assistant for field reps over approved literature", problem: "Medical queries from doctors take nine working days to answer. Officers search approved literature by hand and draft each reply.", fn: "medical", sites: ["All India"], requester: "u-req-med", sponsor: "Head of Medical Affairs", urgency: "HIGH", status: "IN_APPROVAL", route: "R5_CUSTOM_AI", routeReason: "The Knowledge Assistant is a base, but classification, drafting and medical review flow need custom AI.", daysAgo: 55 });
  await generateMap(med.id, "u-pod2");
  await aligned(med.id, 40);
  await addCosts(med.id, [["build", 120], ["integ", 2, "Literature DB + query tracker"], ["llm", 600], ["vector", 1], ["host", 1], ["support", 1]]);
  await selectReuse(med.id, ["A-EKA"]);
  await finishCase(med.id);
  await db.request.update({ where: { id: med.id }, data: { approvalLevel: "L3", financeApprovedAt: ago(6), flagJustification: "Inputs come from the query tracker. Pilot will confirm search time savings." } });
  await approval(med.id, "FIN", "u-fin", "APPROVED", "Inputs checked against the query tracker. OK.", 6, "FINANCE");
  await createLevelApprovals(med.id, "L3");
  const vote = await db.approval.findFirst({ where: { requestId: med.id, approverId: "u-cm1" } });
  if (vote) await db.approval.update({ where: { id: vote.id }, data: { status: "POC", comment: "Start with two therapy areas.", decidedAt: ago(1) } });

  // ── R5: material destruction prediction — approved as POC (L2)
  const mat = await createReq({ title: "Predict material destruction for next 6 months to adjust procurement", problem: "We destroy expired material worth crores each year. Planners cannot see which materials will expire in time to adjust orders.", fn: "supply-chain", sites: ["Goa", "Baddi"], requester: "u-req-sc", sponsor: "Head of Supply Chain", status: "APPROVED_POC", route: "R5_CUSTOM_AI", routeReason: "Needs a prediction model on SAP stock and expiry data.", daysAgo: 75 });
  await addSteps(mat.id, [
    ["Planner extracts expiry and stock data from SAP", "Supply planner", "SAP", 120, 2, 6, "AUTOMATE", "EXTRACTION", 40],
    ["Planner estimates materials likely to expire", "Supply planner", "Excel", 240, 2, 6, "ASSIST", "PREDICTION", 156],
    ["Procurement manager adjusts purchase orders", "Procurement manager", "SAP", 60, 2, 4, "NONE", null, 60],
  ]);
  await aligned(mat.id, 50);
  await addInputs(mat.id, [["COST_AVOIDED", "annualCostAvoided", "Destruction write-off avoided", 4500000, "FINANCE", "FY26 write-off ₹3.0 Cr; Finance estimates 15% avoidable", "MEDIUM", 2500000, 7000000]]);
  await addCosts(mat.id, [["build", 40], ["dbx", 6000], ["host", 1], ["support", 0.1]]);
  await selectReuse(mat.id, ["A-GENIE", "A-MDA"]);
  await finishCase(mat.id);
  await db.request.update({ where: { id: mat.id }, data: { approvalLevel: "L2" } });
  await approval(mat.id, "L2", "u-cm1", "POC", "Pilot on two sites first.", 20, "LEVEL", 5);
  await approval(mat.id, "L2", "u-cm2", "APPROVED", "", 21, "LEVEL", 5);
  await decision(mat.id, "APPROVED_POC", "u-cm1", "Pilot on Goa and Baddi for 3 months. Measure write-off avoided.", 20);

  // ── Inflated ROI example
  const price = await createReq({ title: "Pricing calculator app with AI price suggestions", problem: "Field reps calculate price quotes by hand in Excel. The requester claims ₹9 crore benefit per year from a calculator app.", fn: "commercial-india", sites: ["All India"], requester: "u-req-comm", sponsor: "Commercial director", status: "VALUED", route: "R5_CUSTOM_AI", routeReason: "The requester asks for AI price suggestions inside the calculator; the pod keeps it in assessment to test the claimed value.", daysAgo: 30 });
  await db.request.update({ where: { id: price.id }, data: { claimedBenefit: 90000000 } });
  await addSteps(price.id, [
    ["Field representative calculates the price quote by hand", "Field representative", "Excel", 30, 30, 250, "AUTOMATE", "EXTRACTION", 2],
    ["Pricing desk checks the quote against the price list", "Pricing executive", "Excel", 20, 300, 4, "ASSIST", "CLASSIFICATION", 2],
  ], {
    0: { costPerHour: 2000, meta: str({ minutesPerOccurrence: { source: "USER", note: "", confidence: "LOW" }, occurrencesPerMonth: { source: "USER", note: "", confidence: "LOW" }, peopleCount: { source: "USER", note: "Requester claim", confidence: "LOW" }, costPerHour: { source: "USER", note: "", confidence: "LOW" }, aiMinutes: { source: "USER", note: "Requester claim", confidence: "LOW" } }) },
  });
  await aligned(price.id, 20);
  await addInputs(price.id, [
    ["GENERAL", "realizationFactor", "Realization factor (time saved)", 1, "USER", "Requester: all time saved is money", "LOW"],
    ["GENERAL", "processTeamFte", "FTE who do this process today", 4, "SYSTEM_DATA", "HR data: pricing desk has 4 FTE; reps quote rarely", "HIGH"],
  ]);
  await addCosts(price.id, [["build", 15], ["host", 1]]);

  // ── LIVE, value tracked ABOVE expectation (PPV commentary)
  const ppv = await createReq({ title: "Draft monthly PPV commentary for finance controllers", problem: "Controllers spend two days each month on the purchase price variance commentary. Reasons come slowly by email.", fn: "finance", sites: ["Corporate"], requester: "u-req-fin", sponsor: "CFO office", status: "VALUE_TRACKED", route: "R5_CUSTOM_AI", routeReason: "Needs data extraction from the data lake and drafting.", daysAgo: 300 });
  await generateMap(ppv.id, "u-pod1");
  await aligned(ppv.id, 280);
  await addCosts(ppv.id, [["build", 30], ["llm", 50], ["host", 1]]);
  await selectReuse(ppv.id, ["A-GENIE"]);
  await finishCase(ppv.id);
  await db.request.update({ where: { id: ppv.id }, data: { approvalLevel: "L1", goLiveAt: ago(210) } });
  await approval(ppv.id, "L1", "u-head", "APPROVED", "Good reuse of the data lake.", 260);
  await decision(ppv.id, "APPROVED", "u-head", "Good reuse of the data lake.", 260);
  await actuals(ppv.id, [1.12, 1.2], ["Controllers use it every month.", "Adoption higher than planned: all 18 controllers."]);

  // ── LIVE, value tracked BELOW expectation (batch changeover, GxP → L3)
  const bc = await createReq({ title: "Batch changeover checklist assistant", problem: "Changeover checklists are on paper. Missed entries cause deviations and each changeover takes five hours.", fn: "manufacturing", sites: ["Goa", "Indore"], requester: "u-req-mfg", sponsor: "Site head, Goa", status: "VALUE_TRACKED", route: "R5_CUSTOM_AI", routeReason: "Guided digital checklist with AI checks of entries.", daysAgo: 320, gxp: true });
  await generateMap(bc.id, "u-pod2");
  await aligned(bc.id, 300);
  await addCosts(bc.id, [["build", 70], ["csv", 25], ["integ", 1, "LIMS"], ["host", 1], ["llm", 80], ["support", 0.3]]);
  await selectReuse(bc.id, ["A-QAI"]);
  await finishCase(bc.id);
  await db.request.update({ where: { id: bc.id }, data: { approvalLevel: "L3", goLiveAt: ago(200), flagJustification: "Deviation cost confirmed by site QA." } });
  await approval(bc.id, "L3", "u-chair", "APPROVED", "Approved. Validate before go-live.", 280);
  await decision(bc.id, "APPROVED", "u-chair", "Approved. Complete CSV before go-live.", 280);
  await actuals(bc.id, [0.6, 0.55], ["Night shifts still use paper.", "Adoption at 45%; training planned."]);

  // ── REJECTED
  const canteen = await createReq({ title: "AI chatbot for canteen menu", problem: "Employees want to ask a chatbot for today's canteen menu.", fn: "hr", sites: ["Mumbai HQ"], requester: "u-req-hr", status: "REJECTED", route: "R2_EXTEND", routeReason: "Could use the Knowledge Assistant, but value is very low.", daysAgo: 50 });
  await approval(canteen.id, "L1", "u-head", "REJECTED", "Low value. Publish the menu on the intranet page.", 40);
  await decision(canteen.id, "REJECTED", "u-head", "Low value. Publish the menu on the intranet page.", 40);

  // ── MORE DATA
  const reg = await createReq({ title: "Regulatory dossier section drafting", problem: "Regulatory writers draft repetitive dossier sections by hand for each market.", fn: "regulatory", sites: ["Corporate"], requester: "u-req-quality", status: "MORE_DATA", route: "R5_CUSTOM_AI", routeReason: "Drafting from approved source documents.", daysAgo: 65, gxp: true });
  await addSteps(reg.id, [
    ["Writer collects source documents for the section", "Regulatory writer", "DMS", 120, 4, 10, "AUTOMATE", "EXTRACTION", 45],
    ["Writer drafts the dossier section", "Regulatory writer", "Word", 480, 4, 10, "ASSIST", "DRAFTING", 260],
    ["Regulatory manager reviews and approves the section", "Regulatory manager", "DMS", 90, 4, 3, "NONE", null, 90],
  ]);
  await aligned(reg.id, 45);
  await addCosts(reg.id, [["build", 50], ["csv", 15], ["llm", 150], ["host", 1]]);
  await finishCase(reg.id);
  await db.request.update({ where: { id: reg.id }, data: { approvalLevel: "L3", flagJustification: "Error inputs are estimates." } });
  await approval(reg.id, "L3", "u-chair", "MORE_DATA", "Show the drafting time saving with real data from two dossiers.", 15);
  await decision(reg.id, "MORE_DATA", "u-chair", "Show the drafting time saving with real data from two dossiers.", 15);

  // ── DRAFT
  await createReq({ title: "Contract clause comparison", problem: "Legal compares vendor contract clauses with our standard clauses by hand.", fn: "legal", sites: ["Corporate"], requester: "u-req-fin", status: "DRAFT", daysAgo: 3 });

  // ── IN ASSESSMENT (map from interview, no document)
  const sq = await createReq({ title: "Supplier quality questionnaire review", problem: "Buyers review long supplier quality questionnaires and chase missing answers by email.", fn: "procurement", sites: ["Corporate"], requester: "u-req-sc", status: "IN_ASSESSMENT", route: "R5_CUSTOM_AI", routeReason: "Extraction and classification of free-text answers.", daysAgo: 18,
    summary: { currentProcess: ["Buyer receives the questionnaire by email", "Buyer reads and scores each answer", "Buyer chases missing answers by email", "Quality manager approves the supplier"], timePerOccurrence: "3 hours", frequency: "15 per month", peopleInvolved: "5 buyers", actors: "buyers", tools: ["Email", "Excel"] } });
  await generateMap(sq.id, "u-pod2");

  // ── ALIGNED (ready for simulation)
  const stab = await createReq({ title: "Stability study report drafting", problem: "Analysts compile stability data and draft long stability reports by hand. Reviews find many copy errors.", fn: "rnd", sites: ["Hyderabad R&D"], requester: "u-req-quality", sponsor: "Head of Analytical R&D", status: "ALIGNED", route: "R5_CUSTOM_AI", routeReason: "Data extraction from LIMS plus drafting.", daysAgo: 22, gxp: true });
  await addSteps(stab.id, [
    ["Analyst compiles stability data from LIMS", "Analyst", "LIMS / Excel", 240, 3, 15, "AUTOMATE", "EXTRACTION", 84, 4, 1, 20000],
    ["Analyst drafts the stability report", "Analyst", "Word", 300, 3, 15, "ASSIST", "DRAFTING", 165, 3, 2, 20000],
    ["Reviewer checks the report against the protocol", "Review manager", "Word", 120, 6, 4, "ASSIST", "CLASSIFICATION", 72],
    ["QA approves the report", "QA manager", "DMS", 30, 6, 2, "NONE", null, 30],
  ]);
  await aligned(stab.id, 5);
  await ensureGeneralInputs(stab.id);

  // ── L2 online review; one vote past its deadline (auto-approval demo)
  const sop2 = await createReq({ title: "Demand forecast commentary for S&OP", problem: "Planners build forecast variance tables and write the S&OP commentary by hand each month. Decisions wait for the pack.", fn: "supply-chain", sites: ["Corporate"], requester: "u-req-sc", sponsor: "Head of Supply Chain", status: "IN_APPROVAL", route: "R5_CUSTOM_AI", routeReason: "Extraction from the data lake and drafting.", daysAgo: 35 });
  await addSteps(sop2.id, [
    ["Demand planner prepares forecast variance tables", "Demand planner", "Excel / SAP", 180, 1, 12, "AUTOMATE", "EXTRACTION", 63],
    ["Demand planner writes the forecast commentary", "Demand planner", "PowerPoint", 120, 1, 12, "ASSIST", "DRAFTING", 66],
    ["Planning lead reviews the S&OP pack", "Planning manager", "Teams", 60, 1, 3, "NONE", null, 60],
  ]);
  await aligned(sop2.id, 25);
  await addInputs(sop2.id, [
    ["CYCLE_TIME", "daysReduced", "S&OP decision days saved per year", 24, "USER", "Pack ready 2 days earlier each month", "MEDIUM", 12, 30],
    ["CYCLE_TIME", "valuePerDay", "Working-capital value per day", 150000, "FINANCE", "Finance: inventory carrying cost per day (synthetic)", "MEDIUM"],
  ]);
  await addCosts(sop2.id, [["build", 50], ["dbx", 5000], ["llm", 100], ["host", 1], ["support", 0.1]]);
  await selectReuse(sop2.id, ["A-GENIE"]);
  await finishCase(sop2.id);
  await db.request.update({ where: { id: sop2.id }, data: { approvalLevel: "L2", financeApprovedAt: ago(9) } });
  await approval(sop2.id, "FIN", "u-fin", "APPROVED", "Carrying cost per day confirmed.", 9, "FINANCE");
  await approval(sop2.id, "L2", "u-cm1", "APPROVED", "Good reuse of the data lake.", 4, "LEVEL", 2);
  await db.approval.create({ data: { requestId: sop2.id, level: "L2", stage: "LEVEL", approverId: "u-cm2", status: "PENDING", createdAt: ago(8), dueAt: addWorkingDays(ago(8), 5) } });

  // ── LIVE, value tracking due soon
  const hrqa = await createReq({ title: "HR policy questions via Knowledge Assistant", problem: "Employees email HR with policy questions. HR business partners answer the same questions many times.", fn: "hr", sites: ["All India"], requester: "u-req-hr", status: "LIVE", route: "R2_EXTEND", routeReason: "The Knowledge Assistant already answers HR policy questions for one unit. Extend to all.", daysAgo: 150 });
  await addInputs(hrqa.id, [["COST_AVOIDED", "annualCostAvoided", "HR query handling time avoided", 1000000, "SYSTEM_DATA", "HR ticket data: 5,000 queries/yr × ₹200", "MEDIUM"]]);
  await addCosts(hrqa.id, [["build", 6], ["llm", 300, "Share of Knowledge Assistant usage"]]);
  await selectReuse(hrqa.id, ["A-EKA"]);
  await generateBusinessCase(hrqa.id);
  await db.request.update({ where: { id: hrqa.id }, data: { approvalLevel: "L1", goLiveAt: ago(80) } });
  await approval(hrqa.id, "L1", "u-head", "APPROVED", "Fast route. Go.", 120);
  await decision(hrqa.id, "APPROVED", "u-head", "Fast route. Go.", 120);

  // ── Similarity + route proposals for the whole register
  const all = await db.request.findMany({ select: { id: true, status: true, route: true } });
  for (const r of all) {
    await refreshSimilarity(r.id, false);
    if (r.status === "SUBMITTED") await proposeRoute(r.id);
  }
  return { med, ppv, bc, price };
}

export async function seedCouncilAndMarketplace() {
  await db.councilMeeting.create({ data: { date: new Date("2026-10-01T15:00:00"), minutes: "AI Council – 1 Oct 2026 (synthetic)\n\n- Reviewed Q3 value tracking: PPV commentary above plan; batch changeover below plan (adoption).\n- Agreed: training push for night shifts.\n- Next meeting: first Thursday of November." } });
  await nextCouncilMeeting();
  const reqs = await db.request.findMany({ select: { id: true, title: true } });
  const byTitle = (t: string) => reqs.find((r) => r.title.startsWith(t))?.id ?? null;
  const items = [
    { assetId: "A-QAI", name: "Quality AI Agent", type: "AGENT", description: "Chat over deviations, CAPA, complaints and batch records.", functions: ["Quality"], tier: "CERTIFIED", ownerId: "u-arch", version: "2.1", reviewDate: ahead(150), howToUse: "Open the agent in Teams. Ask about a deviation number, a product or a trend. Answers show the source records.", targetTool: "Custom app", usageCount: 1840, rating: 4.4, ratingCount: 61, securityChecked: true, supportModel: "Digital & AI L2 support" },
    { assetId: "A-QDWA", name: "Quality Document Writing Assistant", type: "AGENT", description: "Checks quality documents against the writing guideline.", functions: ["Quality"], tier: "TEAM", ownerId: "u-pod2", version: "0.9", reviewDate: ahead(60), howToUse: "In Copilot, choose the agent and paste your draft. It lists guideline breaks and suggests simpler words.", targetTool: "Copilot", usageCount: 312, rating: 4.1, ratingCount: 18 },
    { assetId: "A-MYR", name: "Mid-year review summary prompt pack", type: "SKILL", description: "Turns mid-year review notes into strengths and development areas.", functions: ["HR"], tier: "TEAM", ownerId: "u-req-hr", version: "1.2", reviewDate: ahead(90), howToUse: "Copy the prompt into Copilot or Claude. Paste your notes. Do not paste personal data of others.", targetTool: "Copilot", usageCount: 520, rating: 4.0, ratingCount: 33 },
    { assetId: "A-CRMFAQ", name: "CRM Support FAQ Agent", type: "AGENT", description: "Step-by-step answers for CRM how-to questions.", functions: ["Commercial – India"], tier: "TEAM", ownerId: "u-pod1", version: "1.0", reviewDate: ahead(120), howToUse: "Ask the agent in Copilot: 'How do I log a call?'.", targetTool: "Copilot", usageCount: 2210, rating: 4.3, ratingCount: 87, linkedRequestId: byTitle("Answer CRM how-to") },
    { assetId: "A-PRINT", name: "Printing Analytics Dashboard", type: "DATA_PRODUCT", description: "Printing trend by site and department.", functions: ["Admin", "Finance"], tier: "CERTIFIED", ownerId: "u-arch", version: "1.4", reviewDate: ahead(200), howToUse: "Open the Power BI app 'Printing analytics'.", targetTool: "Power BI", usageCount: 140, rating: 3.8, ratingCount: 9, securityChecked: true, supportModel: "Data team" },
    { assetId: "A-GENIE", name: "PPV commentary skill", type: "SKILL", description: "Drafts the monthly purchase price variance commentary from data lake tables.", functions: ["Finance"], tier: "CERTIFIED", ownerId: "u-req-fin", version: "1.3", reviewDate: ahead(100), howToUse: "Run the 'PPV commentary' notebook job, then edit the draft in Word.", targetTool: "Databricks", usageCount: 126, rating: 4.6, ratingCount: 18, linkedRequestId: byTitle("Draft monthly PPV"), securityChecked: true, supportModel: "Finance systems team" },
    { assetId: "A-QAI", name: "Batch changeover checklist agent", type: "AGENT", description: "Guided digital changeover checklist with entry checks.", functions: ["Manufacturing", "Quality"], tier: "CERTIFIED", ownerId: "u-arch", version: "1.1", reviewDate: ahead(45), howToUse: "Open on the line tablet. Scan the product pair. Follow the guided steps.", targetTool: "Custom app", usageCount: 2950, rating: 3.9, ratingCount: 44, linkedRequestId: byTitle("Batch changeover"), securityChecked: true, supportModel: "Site IT + Digital & AI" },
    { assetId: null, name: "Meeting minutes prompt", type: "SKILL", description: "Turns a meeting transcript into decisions and actions.", functions: ["All"], tier: "PERSONAL", ownerId: "u-pod1", version: "0.3", reviewDate: ahead(30), howToUse: "Paste the transcript into Claude with this prompt.", targetTool: "Claude", usageCount: 14, rating: 4.5, ratingCount: 2 },
    { assetId: null, name: "Tender response template", type: "TEMPLATE", description: "Template and prompts to draft institutional tender responses.", functions: ["Commercial – India"], tier: "TEAM", ownerId: "u-req-comm", version: "1.0", reviewDate: new Date(Date.now() - 20 * 86_400_000), howToUse: "Use with ChatGPT Enterprise. Attach the tender document.", targetTool: "ChatGPT", usageCount: 75, rating: 3.6, ratingCount: 7 },
  ];
  for (const i of items) await db.marketplaceItem.create({ data: { ...i, functions: str(i.functions) } });
}

export { DOC_MATCH_MIN };
