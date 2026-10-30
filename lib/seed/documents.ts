// Synthetic process documents. Step lines use a parseable format:
// "N. Step. (Actor: …; System: …; Time: …; Frequency: … per month; People: …; Pain: …)"
// Frequency is per person per month.
export const DOCUMENTS = [
  {
    id: "DOC-SOP-001",
    title: "SOP: Writing and review of standard operating procedures",
    functionId: "quality",
    type: "SOP",
    content: `Purpose
This SOP describes how sites write, review, approve and update standard operating procedures (SOPs). It applies to all manufacturing and quality sites. Each site keeps its own SOPs, but they must follow the global SOP and the corporate writing guideline.

Scope
The procedure covers new SOPs and revisions. It does not cover work instructions or forms. The quality assurance (QA) team owns the procedure. The SOP author is a subject matter expert from the user department.

Responsibilities
The SOP author drafts and updates the SOP. The QA reviewer checks format, content and alignment with the global SOP. The QA head approves the SOP. The training coordinator assigns training after approval.

Procedure
1. Author drafts or revises the SOP in the Word template. (Actor: SOP author; System: Word; Time: 4 hours; Frequency: 2 per month; People: 60; Pain: The template rules are long and authors often miss them)
2. Author checks the draft against the format and writing guideline. (Actor: SOP author; System: Word; Time: 45 min; Frequency: 2 per month; People: 60; Pain: Manual checklist with 40 items)
3. QA reviewer reviews the draft for format and content. (Actor: QA reviewer; System: Word / email; Time: 90 min; Frequency: 8 per month; People: 25; Pain: Most comments are about format, not content)
4. QA reviewer compares the SOP with the global SOP and records gaps. (Actor: QA reviewer; System: SharePoint; Time: 2 hours; Frequency: 8 per month; People: 25; Pain: Global SOPs are hard to find and compare)
5. Author updates the draft from review comments. (Actor: SOP author; System: Word; Time: 60 min; Frequency: 2 per month; People: 60; Pain: Two or three review rounds are common)
6. Author writes the change summary and training impact. (Actor: SOP author; System: Word; Time: 40 min; Frequency: 2 per month; People: 60; Pain: Change summaries are often incomplete)
7. QA head approves and signs the SOP in the document management system. (Actor: QA head; System: DMS; Time: 20 min; Frequency: 10 per month; People: 10)
8. Training coordinator assigns training to affected staff. (Actor: Training coordinator; System: LMS; Time: 30 min; Frequency: 10 per month; People: 10)

Records
The DMS keeps the approved SOP, the review comments and the change history. Review cycle time is reported each month. The average cycle time today is 34 days. Audit observations about SOP quality were raised in three of the last eight inspections.

Notes
Sites write the same SOP in different ways. Harmonization across sites is a corporate goal for the next two years.`,
  },
  {
    id: "DOC-MFG-002",
    title: "SOP: Batch changeover and cleaning",
    functionId: "manufacturing",
    type: "SOP",
    content: `Purpose
This SOP describes the changeover between two product batches on a shared line. It covers line clearance, cleaning, verification and release of the line for the next batch. It applies to oral solid dosage sites.

Responsibilities
The production operator does the cleaning. The shift supervisor checks the line clearance. QA verifies and releases the line. The maintenance team supports when parts must be removed.

Procedure
1. Operator collects the changeover checklist and the cleaning instruction for the product pair. (Actor: Production operator; System: Paper binder; Time: 20 min; Frequency: 20 per month; People: 40; Pain: The right version of the checklist is hard to find)
2. Operator removes materials and documents of the previous batch. (Actor: Production operator; System: Paper; Time: 30 min; Frequency: 20 per month; People: 40)
3. Operator cleans the equipment as per the cleaning instruction. (Actor: Production operator; System: Paper; Time: 3 hours; Frequency: 20 per month; People: 40)
4. Operator records each cleaning step in the batch record. (Actor: Production operator; System: Paper batch record; Time: 25 min; Frequency: 20 per month; People: 40; Pain: Entries are missed and cause deviations)
5. Shift supervisor checks the line clearance and the records. (Actor: Shift supervisor; System: Paper; Time: 30 min; Frequency: 40 per month; People: 12; Pain: Errors are found late)
6. QA officer verifies the line and approves release. (Actor: QA officer; System: Paper / LIMS; Time: 25 min; Frequency: 40 per month; People: 10)

Records and metrics
Changeover time is about five hours on average. About four percent of changeovers have a documentation error that leads to a deviation. Each deviation costs about forty thousand rupees in investigation and delay.

Notes
The site wants a digital checklist with guidance. Operators must keep full control of the cleaning; the system only guides and checks entries.`,
  },
  {
    id: "DOC-MED-003",
    title: "Process: Medical query handling from field representatives",
    functionId: "medical",
    type: "PROCESS_DESC",
    content: `Purpose
Field representatives receive questions from doctors about our products. Representatives may not answer off-label or complex medical questions. They send these questions to Medical Affairs, which replies with an approved answer.

Process
1. Representative logs the doctor's question in the medical query form. (Actor: Field representative; System: Email / form; Time: 15 min; Frequency: 4 per month; People: 1200; Pain: Forms are incomplete and need follow-up)
2. Medical information officer classifies the query and checks if a standard answer exists. (Actor: Medical information officer; System: Excel tracker; Time: 20 min; Frequency: 300 per month; People: 8; Pain: Standard answers are in many folders)
3. Medical information officer searches approved literature and labels. (Actor: Medical information officer; System: SharePoint / literature database; Time: 60 min; Frequency: 120 per month; People: 8; Pain: Search takes long and results vary)
4. Medical information officer drafts the response letter. (Actor: Medical information officer; System: Word; Time: 45 min; Frequency: 120 per month; People: 8)
5. Medical reviewer reviews and approves the response. (Actor: Medical reviewer; System: Email; Time: 20 min; Frequency: 150 per month; People: 4)
6. Medical information officer sends the response and closes the query. (Actor: Medical information officer; System: Email / Excel tracker; Time: 10 min; Frequency: 300 per month; People: 8)

Service level
The target is five working days. Today the average is nine working days. Late answers reduce the trust of doctors. All answers must come from approved sources. No patient-identifiable data is stored in the tracker.`,
  },
  {
    id: "DOC-COM-004",
    title: "Process: Monthly sales effort vs. sales review (commercial)",
    functionId: "commercial-india",
    type: "PROCESS_DESC",
    content: `Purpose
Each month, area and regional sales managers compare field effort (calls, coverage, frequency) with sales and distributor orders. They find territories where effort or sales drop and plan corrective action.

Process
1. Sales analyst downloads call data from CRM and secondary sales data from the distributor system. (Actor: Sales analyst; System: CRM / distributor portal; Time: 3 hours; Frequency: 1 per month; People: 30; Pain: Data comes in different formats)
2. Sales analyst merges the data in Excel by territory. (Actor: Sales analyst; System: Excel; Time: 4 hours; Frequency: 1 per month; People: 30; Pain: Manual mapping of territories)
3. Area sales manager reviews the territory sheet and finds drops in effort or sales. (Actor: Area sales manager; System: Excel; Time: 3 hours; Frequency: 1 per month; People: 400; Pain: Drops are found four to six weeks late)
4. Area sales manager writes a corrective action plan for each weak territory. (Actor: Area sales manager; System: Excel / email; Time: 90 min; Frequency: 1 per month; People: 400)
5. Regional manager discusses plans in the monthly review meeting. (Actor: Regional manager; System: Teams; Time: 2 hours; Frequency: 1 per month; People: 60)

Metrics
Late detection of falling effort costs sales. The commercial team estimates that early alerts can recover part of the lost sales in weak territories. The process uses only internal data. No patient data is used.`,
  },
  {
    id: "DOC-FIN-005",
    title: "Process: Purchase price variance review (finance)",
    functionId: "finance",
    type: "PROCESS_DESC",
    content: `Purpose
Finance controllers review purchase price variance (PPV) each month. They explain large variances to plant and business heads.

Process
1. Controller extracts PPV data from SAP by plant and material. (Actor: Finance controller; System: SAP; Time: 2 hours; Frequency: 1 per month; People: 18; Pain: Several reports must be joined)
2. Controller compares variances with the budget and last month. (Actor: Finance controller; System: Excel; Time: 4 hours; Frequency: 1 per month; People: 18)
3. Controller collects reasons from procurement by email. (Actor: Finance controller; System: Email; Time: 5 hours; Frequency: 1 per month; People: 18; Pain: Replies are slow and incomplete)
4. Controller writes the PPV commentary for the monthly pack. (Actor: Finance controller; System: Word / PowerPoint; Time: 4 hours; Frequency: 1 per month; People: 18)
5. Finance head reviews and approves the commentary. (Actor: Finance head; System: Email; Time: 60 min; Frequency: 1 per month; People: 3)

Notes
The PPV commentary goes to the monthly business review. The enterprise data lake now holds SAP purchasing and GRN data.`,
  },
  {
    id: "DOC-COM-006",
    title: "Process: Market research article management",
    functionId: "commercial-india",
    type: "PROCESS_DESC",
    content: `Purpose
Brand teams buy and collect market research articles, syndicated reports and competitor news. Teams store them in shared folders. Brand managers use them to plan campaigns.

Process
1. Brand executive saves new articles and reports in the shared folder. (Actor: Brand executive; System: SharePoint; Time: 15 min; Frequency: 20 per month; People: 40)
2. Brand manager searches the folders for facts on a topic. (Actor: Brand manager; System: SharePoint; Time: 45 min; Frequency: 10 per month; People: 80; Pain: Search finds file names only, not content)
3. Brand manager reads the articles and notes key facts. (Actor: Brand manager; System: PDF reader; Time: 60 min; Frequency: 10 per month; People: 80)
4. Brand manager writes a short summary for the brand plan. (Actor: Brand manager; System: PowerPoint; Time: 40 min; Frequency: 10 per month; People: 80)

Notes
The same report is often bought twice because teams do not know it exists. The Enterprise Knowledge Assistant can index SharePoint folders with access control.`,
  },
];

export function chunk(content: string, max = 700): string[] {
  const paras = content.split(/\n\s*\n/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > max && cur) {
      out.push(cur.trim());
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur.trim()) out.push(cur.trim());
  // Split very long blocks (procedure lists) by lines.
  return out.flatMap((c) => (c.length <= max * 1.6 ? [c] : c.split("\n").reduce<string[]>((acc, line) => {
    if (!acc.length || (acc[acc.length - 1] + "\n" + line).length > max) acc.push(line);
    else acc[acc.length - 1] += "\n" + line;
    return acc;
  }, [])));
}
