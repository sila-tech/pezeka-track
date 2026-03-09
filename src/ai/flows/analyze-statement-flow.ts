
'use server';
/**
 * @fileOverview AI flow for analyzing M-Pesa statements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeStatementInputSchema = z.object({
  statementDataUri: z.string().describe('Decrypted statement PDF as data URI.'),
});

const AnalyzeStatementOutputSchema = z.object({
  incomeSources: z.array(z.string()).describe('List of identified income sources.'),
  spendingHabits: z.string().describe('Detailed breakdown of spending patterns.'),
  riskAssessment: z.string().describe('Analysis of financial risk and repayment capacity.'),
  recommendation: z.string().describe('Actionable advice for the finance team.'),
  riskLevel: z.enum(['low', 'medium', 'high']).describe('The calculated risk level.'),
});

export type AnalyzeStatementOutput = z.infer<typeof AnalyzeStatementOutputSchema>;

export async function analyzeStatement(input: z.infer<typeof AnalyzeStatementInputSchema>): Promise<AnalyzeStatementOutput> {
  return analyzeStatementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeStatementPrompt',
  input: { schema: AnalyzeStatementInputSchema },
  output: { schema: AnalyzeStatementOutputSchema },
  prompt: `You are an expert Credit Analyst at Pezeka Credit Ltd.
  
  Your task is to analyze the provided M-Pesa statement to determine the customer's creditworthiness.
  
  Focus on:
  1. INCOME: Identify recurring deposits, salary entries, and business income.
  2. SPENDING: Identify where the user spends most of their money (utilities, bets, personal transfers, loans).
  3. LIQUIDITY: Check daily balances and transaction frequency.
  4. DEBT: Look for repayments to other digital lenders (Mshwari, Tala, Fuliza, etc.).
  
  Provide a professional report for the Finance Team.
  
  Statement PDF: {{media url=statementDataUri}}`,
});

const analyzeStatementFlow = ai.defineFlow(
  {
    name: 'analyzeStatementFlow',
    inputSchema: AnalyzeStatementInputSchema,
    outputSchema: AnalyzeStatementOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI failed to generate analysis.');
    return output;
  }
);
