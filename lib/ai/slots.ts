// Client-safe intake questions (no server imports).
export const SLOTS = [
  { key: "function", q: "Hello! I will help you describe your business problem. It takes about 10 minutes.\n\nFirst: which function and team do you work in? (for example: Quality – QA documentation)" },
  { key: "sites", q: "Which site(s) or region does this affect?" },
  { key: "problem", q: "In your own words: what is the problem? What goes wrong or takes too long?" },
  { key: "process", q: "Describe the current process step by step. Which tools do you use (Excel, email, SAP, paper, Word…)? Put each step on a new line or separate with ';'." },
  { key: "effort", q: "Who does this work, how often, and how long does it take? (for example: 12 reviewers, 40 SOPs per month, about 3 hours each)" },
  { key: "pain", q: "What are the main pain points? And what result do you expect if this is solved?" },
  { key: "data", q: "Which data sources or documents are involved? (for example: SOP library, SAP, CRM, LIMS)" },
  { key: "urgency", q: "Last question: how urgent is this (low / medium / high), and who is your sponsor (role, not name)?" },
] as const;

export type Turn = { role: "agent" | "user"; text: string };
