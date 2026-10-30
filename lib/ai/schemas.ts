import { z } from "zod";

export const Conf = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const SummarySchema = z.object({
  title: z.string(),
  function: z.string().default(""),
  subFunction: z.string().default(""),
  sites: z.array(z.string()).default([]),
  problem: z.string(),
  currentProcess: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  actors: z.string().default(""),
  frequency: z.string().default(""),
  timePerOccurrence: z.string().default(""),
  peopleInvolved: z.string().default(""),
  painPoints: z.array(z.string()).default([]),
  expectedResult: z.string().default(""),
  dataSources: z.array(z.string()).default([]),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  sponsor: z.string().default(""),
  gxp: z.boolean().default(false),
  personalData: z.boolean().default(false),
  externalUsers: z.boolean().default(false),
});
export type Summary = z.infer<typeof SummarySchema>;

export const IntakeTurnSchema = z.object({
  done: z.boolean(),
  nextQuestion: z.string().optional(),
  slot: z.string().optional(),
  summary: SummarySchema.optional(),
});

const AnswerSchema = z.object({ answer: z.boolean(), reason: z.string(), evidence: z.array(z.string()).default([]) });
export const RouteSchema = z.object({
  route: z.enum(["R1_EMBEDDED", "R2_EXTEND", "R3_APP", "R4_DATA", "R5_CUSTOM_AI"]),
  answers: z.object({ q1: AnswerSchema, q2: AnswerSchema, q3: AnswerSchema, q4: AnswerSchema }),
  confidence: Conf,
});

export const ReasonSchema = z.object({ reason: z.string().max(200) });

export const MapSchema = z.object({
  steps: z.array(
    z.object({
      name: z.string(),
      actor: z.string().default(""),
      system: z.string().default(""),
      minutesPerOccurrence: z.number().min(0).default(0),
      occurrencesPerMonth: z.number().min(0).default(0),
      peopleCount: z.number().min(0).default(1),
      painPoints: z.array(z.string()).default([]),
      citation: z.string().default(""),
    }),
  ).min(1),
  sourceDocs: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});
export type MapOut = z.infer<typeof MapSchema>;

export const OpportunitySchema = z.object({
  steps: z.array(
    z.object({
      index: z.number().int(),
      aiOpportunity: z.enum(["NONE", "ASSIST", "AUTOMATE"]),
      aiPattern: z.enum(["EXTRACTION", "QA", "CLASSIFICATION", "SUMMARIZATION", "DRAFTING", "PREDICTION", "AGENTIC"]).nullable(),
      withAi: z.object({ minutesPerOccurrence: z.number().min(0), errorRatePct: z.number().min(0) }),
      reason: z.string(),
      confidence: Conf,
    }),
  ),
});
export type OpportunityOut = z.infer<typeof OpportunitySchema>;

export const ReuseSchema = z.object({
  options: z.array(z.object({ assetId: z.string(), mode: z.enum(["AS_IS", "AS_SKILL", "BUILD_NEW"]), fitScore: z.number().min(0).max(1), reason: z.string() })),
});
export type ReuseOut = z.infer<typeof ReuseSchema>;

export const ArchSchema = z.object({ text: z.string(), mermaid: z.string() });

export const CaseSchema = z.object({
  sections: z.object({
    problem: z.string(),
    currentProcess: z.string(),
    proposedSolution: z.string(),
    reuse: z.string(),
    value: z.string(),
    costs: z.string(),
    risks: z.string(),
    governance: z.string(),
    recommendation: z.string(),
  }),
});
export type CaseOut = z.infer<typeof CaseSchema>;

export const SlidesSchema = z.object({
  slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()), keyNumbers: z.array(z.object({ label: z.string(), value: z.string() })).default([]) })).min(1).max(4),
});
export type Slides = z.infer<typeof SlidesSchema>["slides"];
