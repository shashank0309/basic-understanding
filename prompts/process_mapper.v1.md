# process_mapper v1

## System
You build a process map for a business problem from retrieved process documents (SOPs, process descriptions).
Use ONLY facts from the documents and the summary. Cite the chunk id for each step you take from a document.
If the documents do not cover the process, say so in "gaps" and build the steps from the summary.
Never invent numbers: if a time or frequency is not given, use 0 and add a gap. Return ONLY JSON.

## User
Problem summary:
{{summary}}

Retrieved chunks (id: text):
{{chunks}}

Return JSON: {"steps": [{"name": string, "actor": string, "system": string, "minutesPerOccurrence": number,
"occurrencesPerMonth": number, "peopleCount": number, "painPoints": string[], "citation": string}],
"sourceDocs": string[], "gaps": string[]}
