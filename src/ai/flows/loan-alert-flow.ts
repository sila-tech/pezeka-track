'use server';
/**
 * @fileOverview AI flow for generating personalized staff tasks and finance team summaries.
 * Includes temporal promise detection — understands time-relative language in follow-up notes
 * and flags broken promises when a deadline has passed without payment confirmation.
 *
 * - generateLoanAlerts: Main entry point for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LoanAlertInputSchema = z.object({
  userName: z.string().describe('The name of the logged-in staff/admin.'),
  userRole: z.enum(['staff', 'finance']).describe('The role of the user.'),
  currentTime: z.string().describe(
    'Current date and time in full ISO 8601 format, e.g. 2026-04-07T14:30:00+03:00. Use this to reason about whether promises are overdue.'
  ),
  loans: z.array(
    z.object({
      customerName: z.string(),
      loanNumber: z.string(),
      status: z.string(),
      arrears: z.number(),
      balance: z.number(),
      lastNotes: z.array(
        z.object({
          staffName: z.string(),
          content: z.string(),
          date: z
            .string()
            .describe(
              'Full ISO 8601 datetime when this note was written, e.g. 2026-04-06T17:15:00+03:00'
            ),
        })
      ),
    })
  ),
});

const AlertSchema = z.object({
  greeting: z
    .string()
    .describe(
      'Personalized greeting like "Good morning Simon... today seems to be a great day".'
    ),
  summary: z
    .string()
    .describe(
      'A summary of what has been done so far (for afternoon) or what needs to be done (for morning).'
    ),
  alerts: z.array(
    z.object({
      loanNumber: z.string(),
      title: z.string(),
      message: z.string(),
      urgency: z.enum(['low', 'medium', 'high']),
    })
  ),
  teamProgress: z
    .array(z.string())
    .optional()
    .describe(
      'List of strings describing what specific team members are doing (for Finance).'
    ),
});

export type LoanAlertOutput = z.infer<typeof AlertSchema>;

export const loanAlertFlow = ai.defineFlow(
  {
    name: 'loanAlertFlow',
    inputSchema: LoanAlertInputSchema,
    outputSchema: AlertSchema,
  },
  async (input) => {
    // Generate prompt text manually using template literal to ensure safe interpolation
    let loansText = '';
    for (const loan of input.loans) {
      loansText += `\n─── Loan ${loan.loanNumber} | ${loan.customerName} | Arrears: KES ${loan.arrears} ───\n`;
      for (const note of loan.lastNotes) {
        loansText += `  [Written: ${note.date}] ${note.staffName} wrote: "${note.content}"\n`;
      }
    }

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: AlertSchema },
      prompt: `You are an AI Credit Assistant for Pezeka Credit Ltd.

Current User: ${input.userName}
Role: ${input.userRole}
Current Date & Time (ISO 8601): ${input.currentTime}

CONTEXT:
- If it is MORNING (before 12 PM): Be encouraging. Say "Good morning [Name]... today seems to be a great day". List specific follow-up tasks.
- If it is AFTERNOON (after 12 PM): Acknowledge work done. Say "Good afternoon [Name]... here is what has been accomplished".

ROLE SPECIFIC LOGIC:
- For STAFF: Focus on THEIR tasks. Remind them to input comments on each loan they follow up. Flag loans with high arrears or broken promises.
- For FINANCE: Provide a "Team Overview". Describe what other people are doing (e.g., "Simon is following up LN-001", "Henry updated LN-005"). Summarize what customers told the team. Flag all broken promises across the whole team.

═══════════════════════════════════════════
TEMPORAL PROMISE DETECTION — READ CAREFULLY
═══════════════════════════════════════════
Each note has a "date" (ISO 8601 datetime it was WRITTEN) and "content" (what staff recorded).
You must analyze ALL notes to detect whether a customer made a time-bound payment commitment that has since expired.

STEP 1 — DETECT A PROMISE IN THE NOTE CONTENT:
Look for any phrase indicating the customer committed to paying at a specific time. Examples:
- "will pay this evening / tonight / end of day / before close"
- "coming tomorrow / will come tomorrow morning / tomorrow afternoon"
- "promised to pay by [time or day]"
- "said they will deposit / send money / make a payment / transfer"
- "paying at end of week / on Friday / on [specific day]"
- "customer will bring cash in the morning / afternoon / evening"
Any future-oriented payment commitment counts as a promise.

STEP 2 — RESOLVE THE PROMISE DEADLINE:
Given the exact ISO datetime the note was WRITTEN, calculate what real date/time the promise referred to:
- "this evening" or "tonight" → same calendar date as the note, approximately 18:00-21:00
- "end of day" or "by close of business" or "COB" → same calendar date as note, approximately 17:00
- "tomorrow" or "tomorrow morning" → the next calendar day after the note's write date
- "this week" → within 7 days of the note's write date
- A named day like "Friday" → the nearest upcoming Friday from the note's write date
- "in the morning" without a day → same day if written at night, else next morning

STEP 3 — COMPARE DEADLINE TO CURRENT TIME:
Use the Current Date & Time (ISO 8601) to determine status:

A) BROKEN PROMISE (urgency: high):
   - The promise deadline has FULLY PASSED (deadline < current time)
   - AND no later note on that same loan confirms payment was received
   - Alert title: "Broken Promise — [Customer Name]"
   - Alert message: "On [day e.g. 'yesterday' / 'Monday'], [staff name] noted: '[quote the commitment]'.
                     The deadline has passed with no payment recorded. Escalate or reschedule this follow-up."

B) PENDING COMMITMENT DUE TODAY (urgency: medium):
   - The promise deadline is TODAY and has not yet passed
   - Alert title: "Follow Up Today — [Customer Name]"
   - Alert message: "Customer committed to paying [time] (noted by [staff]). Follow up before the deadline."

C) UPCOMING COMMITMENT (urgency: low):
   - The promise is for a future date (tomorrow or later)
   - Mention briefly; no urgent action needed yet.

CRITICAL RULES — DO NOT VIOLATE:
1. A note from YESTERDAY saying "will pay this evening" means commitment was for YESTERDAY EVENING — not today.
   Always anchor the deadline to the note's write date, not to today.
2. If a LATER note on the same loan says "payment received", "paid", "confirmed deposit", "receipt issued",
   or any equivalent → the promise was KEPT. Do NOT flag it as broken.
3. If a staff note says "paid" or confirms a payment was made:
   - Your summary MUST reflect this payment.
   - Look at the "Arrears" amount and "Balance" (remaining overall balance) provided.
   - If Arrears > 0, explicitly state: "Customer made a payment, but still has an outstanding arrears balance of KES [Arrears Amount]."
   - If Arrears is 0 or less, but Balance > 0, explicitly state: "Customer made a payment and cleared arrears, but still has an outstanding overall balance of KES [Balance]."
   - If Balance is 0 or less, state explicitly: "Customer has fully paid and the loan is cleared."
4. Only flag what is explicitly stated. Do not invent promises or assume payment was promised unless stated.
5. If there are NO notes on a loan, do not fabricate a promise — just flag high arrears normally.
6. When describing when a note was written, use human-friendly language: "yesterday", "2 days ago", "on Monday" etc.

DATA (notes listed oldest first — the LAST note is the most recent):
${loansText}

Generate a structured, warm, and professional response. Be specific — name the loan number, customer name,
staff member, and quote the exact commitment phrase when flagging broken promises.`
    });

    return output!;
  }
);

export async function generateLoanAlerts(
  input: z.infer<typeof LoanAlertInputSchema>
): Promise<LoanAlertOutput> {
  return loanAlertFlow(input);
}
