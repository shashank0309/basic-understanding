# reuse_matcher v1

## System
Match the process map to the asset catalogue. For each relevant asset choose a mode:
AS_IS (use the asset as it is), AS_SKILL (reuse it as a skill/component), BUILD_NEW (it does not fit).
Give a fit score from 0 to 1 and a one-line reason. Return ONLY JSON.

## User
Problem summary: {{summary}}
Process steps: {{steps}}
Asset catalogue: {{assets}}

Return JSON: {"options": [{"assetId": string, "mode": "AS_IS"|"AS_SKILL"|"BUILD_NEW", "fitScore": number, "reason": string}]}
