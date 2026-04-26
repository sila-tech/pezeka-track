'use server';

import { PDFDocument } from 'pdf-lib';
import { analyzeMedia } from '@/lib/ai';

export interface StatementAnalysisOutput {
  incomeFlow: number;
  expenditure: number;
  redFlags: string[];
  otherDebts: string[];
  riskLevel: 'Risky' | 'Moderate Risk' | 'Zero Risk / Qualified';
  decisionReason: string;
}

/**
 * Accepts either a base64 data URI or a remote download URL for the statement PDF.
 * If a password is provided, it will decrypt the PDF using pdf-lib before analysis.
 */
export async function analyzeStatementAction(
  fileUrlOrDataUri: string,
  password?: string,
  requestedLoanAmount?: number
): Promise<{ success: boolean; data?: StatementAnalysisOutput; error?: string }> {
  try {
    if (!fileUrlOrDataUri) {
      throw new Error('No file provided.');
    }

    let arrayBuffer: ArrayBuffer;

    const isDataUri = fileUrlOrDataUri.startsWith('data:');

    if (isDataUri) {
      // Already a base64 data URI from the browser — decode it directly
      const base64 = fileUrlOrDataUri.split(',')[1];
      const binaryStr = Buffer.from(base64, 'base64');
      arrayBuffer = binaryStr.buffer.slice(binaryStr.byteOffset, binaryStr.byteOffset + binaryStr.byteLength) as ArrayBuffer;
    } else {
      // Remote URL — download it
      const response = await fetch(fileUrlOrDataUri);
      if (!response.ok) {
        throw new Error('Failed to download the statement PDF from storage.');
      }
      arrayBuffer = await response.arrayBuffer();
    }

    let finalDataUri: string;

    if (password) {
      // Decrypt using pdf-lib
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password });
      const unencryptedBytes = await pdfDoc.save();
      const base64Pdf = Buffer.from(unencryptedBytes).toString('base64');
      finalDataUri = `data:application/pdf;base64,${base64Pdf}`;
    } else {
      // No password — use as-is (re-encode from buffer if we downloaded)
      if (isDataUri) {
        finalDataUri = fileUrlOrDataUri;
      } else {
        const base64Pdf = Buffer.from(arrayBuffer).toString('base64');
        finalDataUri = `data:application/pdf;base64,${base64Pdf}`;
      }
    }

    // Send to direct Google AI SDK
    const systemPrompt = `You are an expert AI Credit Analyst for Pezeka Credit Ltd.
Analyze M-Pesa/Bank statements and evaluate loan applications.

RULES FOR RISK CLASSIFICATION:
1. If the requested loan > income flow, or there are significant red flags (e.g. betting), classify as "Risky".
2. If the requested loan is around 1/2 of the income flow, classify as "Moderate Risk".
3. If the requested loan is <= 1/4 of the income flow, classify as "Zero Risk / Qualified".

RULES FOR RED FLAGS:
- Flag any transactions related to betting, casinos, or high-risk trading platforms.
- Mention them explicitly in the redFlags array.

RULES FOR OTHER DEBTS:
- Look for payments to known lenders (e.g., Tala, Branch, Fuliza, Hustler Fund, M-Kopa, etc.) and list them.

OUTPUT FORMAT:
Return ONLY a JSON object with:
{
  "incomeFlow": number,
  "expenditure": number,
  "redFlags": ["..."],
  "otherDebts": ["..."],
  "riskLevel": "Risky" | "Moderate Risk" | "Zero Risk / Qualified",
  "decisionReason": "..."
}`;

    const taskPrompt = `Requested Loan Amount: KES ${requestedLoanAmount || 0}
    
Please extract the total income and expenditure from the attached statement, identify red flags or other debts, and provide a clear reasoning for your risk classification.`;

    const textResponse = await analyzeMedia(taskPrompt, finalDataUri, "application/pdf", systemPrompt);
    
    // Parse JSON from response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI failed to return a valid JSON analysis.');
    }
    
    const analysisResult = JSON.parse(jsonMatch[0]);

    return { success: true, data: analysisResult };
  } catch (error: any) {
    console.error('[AI STATEMENT ANALYSIS ERROR]:', error);
    return { success: false, error: error.message || 'An error occurred during analysis.' };
  }
}
