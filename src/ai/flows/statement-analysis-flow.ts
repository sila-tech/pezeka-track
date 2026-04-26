'use server';
/**
 * @fileOverview AI flow for analyzing M-Pesa or bank statements.
 * Identifies income, expenditure, red flags, and assesses risk.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StatementAnalysisInputSchema = z.object({
  requestedLoanAmount: z.number().describe('The amount of loan the customer is requesting in KES.'),
  pdfDataUri: z.string().describe('The base64 encoded PDF data URI of the decrypted statement.'),
});

const StatementAnalysisOutputSchema = z.object({
  incomeFlow: z.number().describe('Estimated total money in (income) over the statement period in KES.'),
  expenditure: z.number().describe('Estimated total money out (expenditure) over the statement period in KES.'),
  redFlags: z.array(z.string()).describe('List of risky behaviors found, such as "Betting", "Trading", etc.'),
  otherDebts: z.array(z.string()).describe('List of other loan companies or debt repayments identified in the statement.'),
  riskLevel: z.enum(['Risky', 'Moderate Risk', 'Zero Risk / Qualified']).describe('Calculated risk level based on income vs requested loan.'),
  decisionReason: z.string().describe('Detailed reasoning for the chosen risk level and final assessment.'),
});

export type StatementAnalysisOutput = z.infer<typeof StatementAnalysisOutputSchema>;

export const statementAnalysisFlow = ai.defineFlow(
  {
    name: 'statementAnalysisFlow',
    inputSchema: StatementAnalysisInputSchema,
    outputSchema: StatementAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),

      output: { schema: StatementAnalysisOutputSchema },
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `You are an expert AI Credit Analyst for Pezeka Credit Ltd.
Analyze this M-Pesa/Bank statement and evaluate the loan application.

Requested Loan Amount: KES ${input.requestedLoanAmount}

RULES FOR RISK CLASSIFICATION:
1. If the requested loan > income flow, or there are significant red flags (e.g. betting), classify as "Risky".
2. If the requested loan is around 1/2 of the income flow, classify as "Moderate Risk".
3. If the requested loan is <= 1/4 of the income flow, classify as "Zero Risk / Qualified".

RULES FOR RED FLAGS:
- Flag any transactions related to betting, casinos, or high-risk trading platforms.
- Mention them explicitly in the redFlags array.

RULES FOR OTHER DEBTS:
- Look for payments to known lenders (e.g., Tala, Branch, Fuliza, Hustler Fund, M-Kopa, etc.) and list them.

Please extract the total income and expenditure over the period, identify the items above, and provide a clear reasoning.`
            },
            {
              media: { url: input.pdfDataUri }
            }
          ]
        }
      ]
    });

    return output!;
  }
);

export async function runStatementAnalysisFlow(
  input: z.infer<typeof StatementAnalysisInputSchema>
): Promise<StatementAnalysisOutput> {
  return statementAnalysisFlow(input);
}
