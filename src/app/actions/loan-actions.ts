
'use server';

/**
 * @fileOverview Server actions for handling loan applications with AI statement analysis.
 */

import { PDFDocument } from 'pdf-lib';
import { analyzeStatement } from '@/ai/flows/analyze-statement-flow';
import { z } from 'zod';

const applicationSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  principalAmount: z.number(),
  interestRate: z.number(),
  numberOfInstalments: z.number(),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  loanType: z.string(),
  idNumber: z.string(),
  alternativeNumber: z.string().optional(),
  statementPdfBase64: z.string().optional(),
  statementPassword: z.string().optional(),
});

/**
 * Processes a loan application including AI analysis of the M-Pesa statement.
 */
export async function submitLoanWithAnalysis(formData: z.infer<typeof applicationSchema>) {
  try {
    let aiReport = null;

    // 1. Process Statement if provided
    if (formData.statementPdfBase64) {
      try {
        const pdfBytes = Buffer.from(formData.statementPdfBase64, 'base64');
        let processedPdfBase64 = formData.statementPdfBase64;

        // Decrypt PDF if password provided
        if (formData.statementPassword) {
          const pdfDoc = await PDFDocument.load(pdfBytes, { 
            password: formData.statementPassword,
            ignoreEncryption: false 
          });
          const decryptedBytes = await pdfDoc.save();
          processedPdfBase64 = Buffer.from(decryptedBytes).toString('base64');
        }

        const dataUri = `data:application/pdf;base64,${processedPdfBase64}`;
        const analysis = await analyzeStatement({ statementDataUri: dataUri });
        
        aiReport = {
          ...analysis,
          analysisDate: new Date().toISOString()
        };
      } catch (pdfError: any) {
        console.error("Statement Analysis Error:", pdfError);
        // We continue the application even if AI fails, but log it
      }
    }

    return { success: true, aiReport };
  } catch (error: any) {
    console.error("Application processing critical error:", error);
    return { success: false, error: error.message };
  }
}
