'use server';

import { PDFDocument } from 'pdf-lib';
import { runStatementAnalysisFlow, StatementAnalysisOutput } from '@/ai/flows/statement-analysis-flow';

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

    // Send to Genkit AI
    const analysisResult = await runStatementAnalysisFlow({
      requestedLoanAmount: requestedLoanAmount || 0,
      pdfDataUri: finalDataUri,
    });

    return { success: true, data: analysisResult };
  } catch (error: any) {
    console.error('[AI STATEMENT ANALYSIS ERROR]:', error);
    return { success: false, error: error.message || 'An error occurred during analysis.' };
  }
}
