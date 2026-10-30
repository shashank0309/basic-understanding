// Synthetic demo data. No real client data. Used by `npm run setup` and the "Reset demo data" button.
import { db } from "../db";
import { str } from "../json";
import { embed } from "../similarity/embeddings";
import { DEFAULT_SETTINGS } from "../settings";
import { LEVERS } from "../value/levers";
import { indexDocument } from "../services/documents";
import { DOCUMENTS } from "./documents";


export const FUNCTIONS = [
  ["rnd", "R&D"], ["manufacturing", "Manufacturing"], ["quality", "Quality"], ["commercial-india", "Commercial – India"],
  ["commercial-us", "Commercial – Branded (US)"], ["medical", "Medical Affairs"], ["supply-chain", "Supply Chain"],
  ["regulatory", "Regulatory"], ["hr", "HR"], ["finance", "Finance"], ["procurement", "Procurement"], ["legal", "Legal"],
] as const;

export const USERS = [
  ["u-req-quality", "Priya Nair", "REQUESTER", "quality"],
  ["u-req-comm", "Rahul Mehta", "REQUESTER", "commercial-india"],
  ["u-req-med", "Ananya Rao", "REQUESTER", "medical"],
  ["u-req-hr", "Kavita Menon", "REQUESTER", "hr"],
  ["u-req-mfg", "Suresh Patil", "REQUESTER", "manufacturing"],
  ["u-req-sc", "Deepak Joshi", "REQUESTER", "supply-chain"],
  ["u-req-fin", "Meera Iyer", "REQUESTER", "finance"],
  ["u-pod1", "Arjun Sharma", "POD_ANALYST", null],
  ["u-pod2", "Neha Gupta", "POD_ANALYST", null],
  ["u-arch", "Vikram Singh", "ARCHITECT", null],
  ["u-fin", "Lakshmi Krishnan", "FINANCE", "finance"],
  ["u-itbp", "Rohit Verma", "ITBP", null],
  ["u-cm1", "Sanjay Kulkarni", "COUNCIL_MEMBER", null],
  ["u-cm2", "Farah Khan", "COUNCIL_MEMBER", null],
  ["u-chair", "Ramesh Iyengar", "COUNCIL_CHAIR", null],
  ["u-head", "Sunita Reddy", "DIGITAL_HEAD", null],
  ["u-admin", "Platform Admin", "ADMIN", null],
] as const;

const ASSETS = [
  { id: "A-EKA", name: "Enterprise Knowledge Assistant", type: "PLATFORM", description: "Document Q&A and search over enterprise documents with access control. Indexes SharePoint folders, SOPs, policies and articles. Answers questions with citations.", capabilities: ["document Q&A", "search", "citations", "access control", "summarization"], dataSources: ["SharePoint", "DMS"], functionsUsing: ["HR", "Commercial – India", "Medical Affairs (pilot)", "Quality (pilot)"], maturity: "LIVE", targetTool: "Custom app" },
  { id: "A-QAI", name: "Quality AI Agent", type: "AGENT", description: "Chat over quality structured and unstructured data: deviations, CAPA, complaints and batch records.", capabilities: ["quality data chat", "deviation analysis", "trend questions"], dataSources: ["TrackWise", "LIMS", "Data lake"], functionsUsing: ["Quality"], maturity: "LIVE", targetTool: "Custom app" },
  { id: "A-GENIE", name: "Enterprise Data Lake / Genie query", type: "DATA_PRODUCT", description: "Natural-language queries over SAP, budget and GRN data in the enterprise data lake.", capabilities: ["natural-language query", "SAP data", "budget data", "purchase data"], dataSources: ["SAP", "Budget", "GRN"], functionsUsing: ["Finance (pilot)"], maturity: "PILOT", targetTool: "Databricks" },
  { id: "A-MDA", name: "Material Destruction Approval App", type: "APPLICATION", description: "SAP-integrated approval workflow for material destruction requests at India sites.", capabilities: ["approval workflow", "SAP integration", "material destruction"], dataSources: ["SAP"], functionsUsing: ["Supply Chain", "Manufacturing"], maturity: "LIVE", targetTool: "Custom app" },
  { id: "A-CRMFAQ", name: "CRM Support FAQ Agent", type: "AGENT", description: "Step-by-step answers for CRM how-to questions for field representatives.", capabilities: ["CRM how-to", "FAQ answers", "field rep support"], dataSources: ["CRM help pages"], functionsUsing: ["Commercial – India (one division)"], maturity: "PILOT", targetTool: "Copilot" },
  { id: "A-QDWA", name: "Quality Document Writing Assistant", type: "AGENT", description: "Copilot Studio agent that checks quality documents against the writing guideline and suggests clearer wording.", capabilities: ["writing guideline check", "plain language", "document format check"], dataSources: ["Writing guideline"], functionsUsing: ["Quality (one team)"], maturity: "PILOT", targetTool: "Copilot" },
  { id: "A-PRINT", name: "Printing Analytics Dashboard", type: "DATA_PRODUCT", description: "Printing trend by site and department.", capabilities: ["printing report", "dashboard"], dataSources: ["Print server logs"], functionsUsing: ["Admin"], maturity: "LIVE", targetTool: "Power BI" },
  { id: "A-SFAI", name: "SuccessFactors AI writing assist", type: "EMBEDDED_FEATURE", description: "Embedded AI that helps managers write goals and performance review comments in SuccessFactors.", capabilities: ["goal writing", "review comments", "performance review"], dataSources: ["SuccessFactors"], functionsUsing: ["HR"], maturity: "LIVE", targetTool: "SuccessFactors" },
  { id: "A-MYR", name: "Mid-year review summary prompt pack", type: "SKILL", description: "Prompt pack that summarizes mid-year review notes into strengths and development areas.", capabilities: ["summarization", "review notes"], dataSources: [], functionsUsing: ["HR"], maturity: "PILOT", targetTool: "Copilot" },
];

const CAPABILITIES = [
  { software: "SuccessFactors", feature: "AI writing assist for goals and performance review comments", available: "NOW", notes: "Licensed; enable per business unit." },
  { software: "SAP", feature: "Joule assistant features for procurement and finance", available: "ROADMAP", roadmapDate: "2027 Q1", notes: "Depends on S/4 upgrade." },
  { software: "CRM", feature: "Call notes summary for field representatives", available: "ROADMAP", roadmapDate: "2027 Q2", notes: "Vendor roadmap." },
  { software: "LIMS", feature: "New version rollout with sample tracking", available: "NOW", notes: "Rollout to all QC labs." },
  { software: "TrackWise", feature: "AI classification of deviations and complaints", available: "ROADMAP", roadmapDate: "2027 Q3", notes: "Vendor preview." },
];

const BENCHMARKS = [
  ["EXTRACTION", "Data extraction / entry", 50, 80, "Form and document data capture"],
  ["QA", "Q&A over documents", 50, 80, "Reduction in search time"],
  ["CLASSIFICATION", "Checking / classification", 30, 60, "Checks against rules or templates"],
  ["SUMMARIZATION", "Summarization", 40, 70, "Reading and summarizing documents"],
  ["DRAFTING", "Document drafting with AI assist", 30, 60, "First drafts; a person edits"],
  ["PREDICTION", "Prediction / forecasting", 20, 50, "Analyst preparation time"],
  ["AGENTIC", "Agentic workflow", 40, 75, "Routing, follow-up and reminders"],
] as const;

const RATES = [["Operator", 450], ["Executive / analyst", 900], ["Field representative", 700], ["Specialist", 1600], ["Manager", 1800], ["Senior leader", 4000]] as const;

const COST_CARDS = [
  ["llm", "LLM usage", "1M tokens", 1500, "AI", "ANNUAL", "Blended input/output price (demo value)"],
  ["vector", "Vector store / search index", "index-year", 240000, "AI", "ANNUAL", ""],
  ["dbx", "Databricks compute", "DBU", 45, "Data", "ANNUAL", ""],
  ["cs", "Copilot Studio messages", "25k-message pack per year", 198000, "AI", "ANNUAL", ""],
  ["host", "App hosting (Azure App Service)", "app-year", 180000, "Platform", "ANNUAL", ""],
  ["lic", "Licences", "user-year", 12000, "Licence", "ANNUAL", ""],
  ["build", "Build effort", "person-day", 16000, "People", "ONE_TIME", "Blended internal + partner rate"],
  ["csv", "Validation effort (CSV/CSA)", "person-day", 18000, "People", "ONE_TIME", "GxP only"],
  ["integ", "Integration", "interface", 400000, "People", "ONE_TIME", ""],
  ["support", "Support", "FTE-year", 1800000, "People", "ANNUAL", ""],
] as const;

export async function wipe() {
  const t = db as unknown as Record<string, { deleteMany: () => Promise<unknown> }>;
  for (const m of [
    "accessRequest", "notification", "editLog", "auditEvent", "valueActual", "marketplaceItem", "decision", "approval", "businessCase",
    "costItem", "valueInput", "reuseOption", "processStep", "similarityLink", "intakeMessage", "request", "councilMeeting", "cluster",
    "docChunk", "processDocument", "softwareCapability", "asset", "componentCostCard", "roleCostRate", "benchmark", "valueLever", "user", "function", "setting",
  ]) await t[m].deleteMany();
}

export async function seedReference() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await db.setting.create({ data: { key: k, value: v.value, label: v.label, group: v.group } });
  for (const [id, name] of FUNCTIONS) await db.function.create({ data: { id, name } });
  for (const [id, name, role, fn] of USERS) {
    await db.user.create({ data: { id, name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, roles: role, functionId: fn } });
  }
  await db.user.create({ data: { id: "system", name: "System", email: "system@example.com", roles: "SYSTEM" } });
  for (const a of ASSETS) {
    await db.asset.create({ data: { ...a, capabilities: str(a.capabilities), dataSources: str(a.dataSources), functionsUsing: str(a.functionsUsing), ownerId: "u-arch", embedding: str(embed(`${a.name}. ${a.description}. ${a.capabilities.join(", ")}`)) } });
  }
  for (const c of CAPABILITIES) await db.softwareCapability.create({ data: { ...c, embedding: str(embed(`${c.software} ${c.feature}`)) } });
  for (const [pattern, label, lowPct, highPct, note] of BENCHMARKS) await db.benchmark.create({ data: { pattern, label, lowPct, highPct, note } });
  for (const [band, ratePerHour] of RATES) await db.roleCostRate.create({ data: { band, ratePerHour } });
  for (const [id, name, unit, unitCostINR, category, kind, notes] of COST_CARDS) await db.componentCostCard.create({ data: { id, name, unit, unitCostINR, category, kind, notes } });
  for (const l of LEVERS) await db.valueLever.create({ data: { key: l.key, name: l.name, formula: l.formula, description: l.description } });
  for (const d of DOCUMENTS) {
    await db.processDocument.create({ data: { id: d.id, title: d.title, functionId: d.functionId, type: d.type, content: d.content } });
    await indexDocument(d.id, d.title, d.content);
  }
}

export async function seedAll() {
  const prev = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = "mock"; // seed is deterministic and offline
  try {
    await wipe();
    await seedReference();
    const { seedRequests, seedCouncilAndMarketplace } = await import("./requests");
    await seedRequests();
    await seedCouncilAndMarketplace();
  } finally {
    process.env.LLM_PROVIDER = prev;
  }
}
