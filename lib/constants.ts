export const ROLES = ["REQUESTER", "POD_ANALYST", "ARCHITECT", "FINANCE", "ITBP", "COUNCIL_MEMBER", "COUNCIL_CHAIR", "DIGITAL_HEAD", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  POD_ANALYST: "Pod analyst",
  ARCHITECT: "Architect",
  FINANCE: "Finance",
  ITBP: "IT business partner",
  COUNCIL_MEMBER: "Council member",
  COUNCIL_CHAIR: "Council chair",
  DIGITAL_HEAD: "Head of Digital & AI",
  ADMIN: "Admin",
};

export const STATUSES = [
  "DRAFT", "SUBMITTED", "ROUTED", "IN_ASSESSMENT", "ALIGNED", "VALUED", "DESIGNED", "IN_APPROVAL",
  "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED", "CLOSED_EXITED",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", ROUTED: "Routed", IN_ASSESSMENT: "In assessment", ALIGNED: "Aligned",
  VALUED: "Valued", DESIGNED: "Designed", IN_APPROVAL: "In approval", APPROVED: "Approved", APPROVED_POC: "Approved as POC",
  REJECTED: "Rejected", MORE_DATA: "More data asked", IN_DELIVERY: "In delivery", LIVE: "Live", VALUE_TRACKED: "Value tracked",
  CLOSED_EXITED: "Exited to other team",
};

export const FUNNEL = [
  { key: "submitted", label: "Submitted", statuses: STATUSES.filter((s) => s !== "DRAFT") as readonly string[] },
  { key: "routed", label: "Routed", statuses: ["ROUTED", "IN_ASSESSMENT", "ALIGNED", "VALUED", "DESIGNED", "IN_APPROVAL", "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED", "CLOSED_EXITED"] },
  { key: "assessed", label: "Assessed", statuses: ["VALUED", "DESIGNED", "IN_APPROVAL", "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"] },
  { key: "decided", label: "Decided", statuses: ["APPROVED", "APPROVED_POC", "REJECTED", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"] },
  { key: "delivered", label: "Delivered", statuses: ["LIVE", "VALUE_TRACKED"] },
  { key: "tracked", label: "Value tracked", statuses: ["VALUE_TRACKED"] },
];

export const AI_PATTERNS = ["EXTRACTION", "QA", "CLASSIFICATION", "SUMMARIZATION", "DRAFTING", "PREDICTION", "AGENTIC"] as const;
export const PATTERN_LABELS: Record<string, string> = {
  EXTRACTION: "Extraction", QA: "Q&A", CLASSIFICATION: "Classification", SUMMARIZATION: "Summarization",
  DRAFTING: "Drafting", PREDICTION: "Prediction", AGENTIC: "Agentic workflow",
};
