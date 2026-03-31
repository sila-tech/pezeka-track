'use server';
/**
 * @fileOverview AI flow for generating personalized staff tasks and finance team summaries.
 * 
 * - generateLoanAlerts: Main entry point for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LoanAlertInputSchema = z.object({
  userName: z.string().describe('The name of the logged-in staff/admin.'),
  userRole: z.enum(['staff', 'finance']).describe('The role of the user.'),
  currentTime: z.string().describe('ISO or formatted current time.'),
  loans: z.array(z.object({
    customerName: z.string(),
    loanNumber: z.string(),
    status: z.string(),
    arrears: z.number(),
    lastNotes: z.array(z.object({
      staffName: z.string(),
      content: z.string(),
      date: z.string(),
    })),
  })),
});

const AlertSchema = z.object({
  greeting: z.string().describe('Personalized greeting like "Good morning Simon... today seems to be a great day".'),
  summary: z.string().describe('A summary of what has been done so far (for afternoon) or what needs to be done (for morning).'),
  alerts: z.array(z.object({
    loanNumber: z.string(),
    title: z.string(),
    message: z.string(),
    urgency: z.enum(['low', 'medium', 'high']),
  })),
  teamProgress: z.array(z.string()).optional().describe('List of strings describing what specific team members are doing (for Finance).'),
});

export type LoanAlertOutput = z.infer<typeof AlertSchema>;

const prompt = ai.definePrompt({
  name: 'loanAlertPrompt',
  input: { schema: LoanAlertInputSchema },
  output: { schema: AlertSchema },
  prompt: `You are an AI Credit Assistant for Pezeka Credit Ltd. 
  
  Current User: {{{userName}}}
  Role: {{{userRole}}}
  Current Time: {{{currentTime}}}
  
  CONTEXT:
  - If it is MORNING (before 12 PM): Be encouraging. Say "Good morning [Name]... today seems to be a great day". List specific follow-up tasks.
  - If it is AFTERNOON (after 12 PM): Acknowledge work done. Say "Good afternoon [Name]... here is what has been accomplished". 
  
  ROLE SPECIFIC LOGIC:
  - For STAFF: Focus on THEIR tasks. Remind them to input comments on each loan they follow up. Flag loans with high arrears or broken promises.
  - For FINANCE: Provide a "Team Overview". Describe what other people are doing (e.g., "Simon is following up LN-001", "Henry updated LN-005"). Summarize what customers told the team (e.g., "Customer told Simon they will pay by noon").
  
  DATA:
  {{#each loans}}
  - Loan {{loanNumber}} ({{customerName}}): Arrears KES {{arrears}}. 
    Recent interactions:
    {{#each lastNotes}}
    * {{staffName}} at {{date}}: "{{content}}"
    {{/each}}
  {{/each}}
  
  Generate a structured response with a warm, professional tone.`,
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
