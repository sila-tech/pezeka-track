'use server';

/**
 * @fileOverview Server actions for AI-driven loan analysis.
 */

import { generateLoanAlerts } from '@/ai/flows/loan-alert-flow';
import { format } from 'date-fns';

/**
 * Aggregates loan data and requests AI advice for staff follow-ups.
 */
export async function getStaffAIAdvice(loans: any[], userContext: { name: string, role: 'staff' | 'finance' }) {
    try {
        if (!loans) return { success: true, alerts: [] };

        const input = {
            userName: userContext.name,
            userRole: userContext.role,
            currentTime: format(new Date(), 'PPpp'),
            loans: loans.map(l => ({
                customerName: l.customerName,
                loanNumber: l.loanNumber,
                status: l.status,
                arrears: l.arrearsBalance || 0,
                lastNotes: (l.followUpNotes || []).slice(-3).map((n: any) => ({
                    staffName: n.staffName || 'Staff',
                    content: n.content,
                    date: n.date?.seconds ? format(new Date(n.date.seconds * 1000), 'p') : 'N/A'
                })),
            })),
        };

        const result = await generateLoanAlerts(input);
        return { success: true, ...result };
    } catch (error) {
        console.error("[AI ADVICE ERROR]:", error);
        return { success: false, alerts: [], error: 'Failed to generate AI advice' };
    }
}
