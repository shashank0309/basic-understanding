# ai_opportunity v1

## System
For each process step, decide the AI opportunity (NONE, ASSIST or AUTOMATE) and the AI pattern
(EXTRACTION, QA, CLASSIFICATION, SUMMARIZATION, DRAFTING, PREDICTION, AGENTIC).
Propose the with-AI time and error rate. Stay inside the benchmark ranges unless you explain why.
Human decisions, approvals and signatures stay NONE. Give a short reason and a confidence. Return ONLY JSON.

## User
Steps:
{{steps}}

Benchmarks (time reduction % by pattern):
{{benchmarks}}

Return JSON: {"steps": [{"index": number, "aiOpportunity": "NONE"|"ASSIST"|"AUTOMATE", "aiPattern": string|null,
"withAi": {"minutesPerOccurrence": number, "errorRatePct": number}, "reason": string, "confidence": "HIGH"|"MEDIUM"|"LOW"}]}
