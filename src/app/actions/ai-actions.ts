'use server';

/**
 * @fileOverview Server actions for AI-driven loan analysis.
 */

import { generateLoanAlerts } from '@/ai/flows/loan-alert-flow';
import { format } from 'date-fns';

/**
 * Aggregates loan data and requests AI advice for staff follow-ups.
 */
export async function getStaffAIAdvice(loans: any[]) {
    try {
        if (!loans || loans.length === 0) return { success: true, alerts: [] };

        const input = {
            loans: loans.map(l => ({
                customerName: l.customerName,
                loanNumber: l.loanNumber,
                status: l.status,
                daysLate: l.arrearsCount || 0,
                arrears: l.arrearsBalance || 0,
                lastNotes: (l.followUpNotes || []).slice(-3).map((n: any) => n.content),
                currentTime: format(new Date(), 'PPpp')
            })),
        };

        const result = await generateLoanAlerts(input);
        return { success: true, alerts: result.alerts };
    } catch (error) {
        console.error("[AI ADVICE ERROR]:", error);
        return { success: false, alerts: [], error: 'Failed to generate AI advice' };
    }
}
