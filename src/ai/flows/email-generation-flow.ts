
'use server';
/**
 * @fileOverview AI-powered email generation flow for Pezeka Credit Ltd.
 *
 * This flow generates professional, personalized email content for customers based on specific events.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EmailEventSchema = z.object({
  type: z.enum(['welcome', 'loan_approved', 'payment_received', 'penalty_applied']),
  data: z.object({
    customerName: z.string(),
    loanNumber: z.string().optional(),
    amount: z.number().optional(),
    balance: z.number().optional(),
    dueDate: z.string().optional(),
    description: z.string().optional(),
  }),
});

export type EmailEventInput = z.infer<typeof EmailEventSchema>;

const EmailOutputSchema = z.object({
  subject: z.string().describe('The email subject line.'),
  body: z.string().describe('The full email body text, professionally formatted.'),
});

export type EmailOutput = z.infer<typeof EmailOutputSchema>;

export async function generateEmailContent(input: EmailEventInput): Promise<EmailOutput> {
  return emailGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'emailGenerationPrompt',
  input: { schema: EmailEventSchema },
  output: { schema: EmailOutputSchema },
  prompt: `You are the lead communications officer for Pezeka Credit Ltd, a professional and friendly credit solutions provider in Kenya.

Generate a professional email based on the following event:

Event Type: {{{type}}}
Customer Name: {{{data.customerName}}}
{{#if data.loanNumber}}Loan Number: {{{data.loanNumber}}}{{/if}}
{{#if data.amount}}Amount: Ksh {{{data.amount}}}{{/if}}
{{#if data.balance}}Current Balance: Ksh {{{data.balance}}}{{/if}}
{{#if data.dueDate}}Due Date: {{{data.dueDate}}}{{/if}}
{{#if data.description}}Details: {{{data.description}}}{{/if}}

Guidelines:
- Maintain a professional, trustworthy, and supportive tone.
- Ensure the Pezeka Credit Ltd branding is clear.
- For 'welcome', thank them for joining and explain our commitment to affordable credit.
- For 'loan_approved', congratulate them and clearly state the amount disbursed and their repayment schedule.
- For 'payment_received', confirm receipt and provide their remaining balance.
- For 'penalty_applied', be firm but professional about the missed deadline and explain how to settle it to avoid further costs.
- Include a standard sign-off from "The Pezeka Credit Team".`,
});

const emailGenerationFlow = ai.defineFlow(
  {
    name: 'emailGenerationFlow',
    inputSchema: EmailEventSchema,
    outputSchema: EmailOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
