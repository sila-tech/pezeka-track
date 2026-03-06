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
  prompt: `You are the lead communications officer for Pezeka Credit Ltd.

Generate a short, precise, and professional email for the following event:

Event Type: {{{type}}}
Customer Name: {{{data.customerName}}}
{{#if data.loanNumber}}Loan Number: {{{data.loanNumber}}}{{/if}}
{{#if data.amount}}Amount: Ksh {{{data.amount}}}{{/if}}
{{#if data.balance}}Balance: Ksh {{{data.balance}}}{{/if}}
{{#if data.dueDate}}Due Date: {{{data.dueDate}}}{{/if}}
{{#if data.description}}Details: {{{data.description}}}{{/if}}

Guidelines:
- Keep the message very short and precise. No fluff.
- Tone: Professional, trustworthy, and supportive.
- For 'welcome': Briefly thank them for joining Pezeka Credit.
- For 'loan_approved': Congratulate them, confirm the disbursement amount, and state the balance.
- For 'payment_received': Confirm receipt of the amount and provide their remaining balance.
- For 'penalty_applied': Professionally notify them of the penalty and the reason provided in the details.
- Always conclude with the following footer:
  
  Best regards,
  The Pezeka Credit Team
  Website: pezeka.com
  Phone: +254 757 664047`,
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
