'use server';
/**
 * @fileOverview AI flow for analyzing loan follow-up notes and generating staff alerts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LoanAlertInputSchema = z.object({
  loans: z.array(z.object({
    customerName: z.string(),
    loanNumber: z.string(),
    status: z.string(),
    daysLate: z.number(),
    arrears: z.number(),
    lastNotes: z.array(z.string()),
    currentTime: z.string(),
  })),
});

const AlertSchema = z.object({
  alerts: z.array(z.object({
    loanNumber: z.string(),
    title: z.string(),
    message: z.string(),
    urgency: z.enum(['low', 'medium', 'high']),
  })),
});

export type LoanAlertOutput = z.infer<typeof AlertSchema>;

const prompt = ai.definePrompt({
  name: 'loanAlertPrompt',
  input: { schema: LoanAlertInputSchema },
  output: { schema: AlertSchema },
  prompt: `You are an AI Credit Assistant for Pezeka Credit Ltd. 
  Your job is to read follow-up notes and loan statuses to suggest IMMEDIATE actions for staff.
  
  Current Server Time: {{{currentTime}}}
  
  For each loan provided:
  1. Look at the status and arrears.
  2. Read the "lastNotes" (most recent first).
  3. Identify if the customer made a specific promise (e.g., "will pay by noon", "check tomorrow morning", "afternoon").
  4. If the promised time has arrived or passed, create a high urgency alert.
  5. If the customer is overdue and has no promise, create a medium urgency alert suggesting a check-in.
  6. For "afternoon" promises, if it is currently after 12:00 PM, flag it.
  
  Loans Data:
  {{#each loans}}
  - Loan {{loanNumber}} ({{customerName}}): Status: {{status}}, Arrears: KES {{arrears}}, Days Late: {{daysLate}}. 
    Notes: 
    {{#each lastNotes}}
    * "{{this}}"
    {{/each}}
  {{/each}}
  
  Be precise and helpful. If someone promised "afternoon" and it is currently afternoon, flag it as a priority follow-up.
  `,
});

export const loanAlertFlow = ai.defineFlow(
  {
    name: 'loanAlertFlow',
    inputSchema: LoanAlertInputSchema,
    outputSchema: AlertSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function generateLoanAlerts(input: z.infer<typeof LoanAlertInputSchema>): Promise<LoanAlertOutput> {
  return loanAlertFlow(input);
}
