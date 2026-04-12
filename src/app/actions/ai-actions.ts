'use server';

/**
 * @fileOverview Server actions for AI-driven loan analysis with temporal promise detection.
 * Passes full ISO datetime for each note so the AI can reason about broken promises.
 */

import { generateLoanAlerts } from '@/ai/flows/loan-alert-flow';

/**
 * Converts a Firestore Timestamp-like object or Date to a full ISO 8601 string.
 * The AI needs the full date+time to detect broken promises.
 */
function toISOString(date: any): string {
    if (!date) return new Date().toISOString();
    if (date instanceof Date) return date.toISOString();
    if (typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toISOString();
    }
    try {
        return new Date(date).toISOString();
    } catch {
        return new Date().toISOString();
    }
}

/**
 * Aggregates loan data and requests AI advice for staff follow-ups.
 * Sends FULL ISO datetimes so the AI can detect time-relative broken promises.
 */
export async function getStaffAIAdvice(loans: any[], userContext: { name: string, role: 'staff' | 'finance' }) {
    try {
        if (!loans) return { success: true, alerts: [] };

        const input = {
            userName: userContext.name,
            userRole: userContext.role,
            // Full ISO datetime with timezone offset so AI can reason about "this evening" vs "yesterday evening"
            currentTime: new Date().toISOString(),
            loans: loans.map(l => ({
                customerName: l.customerName,
                loanNumber: l.loanNumber,
                status: l.status,
                arrears: l.arrearsBalance || 0,
                balance: l.remainingBalance || 0,
                // Send ALL notes (not just last 3) so AI can see the full conversation history
                // and detect if a later note cancels a broken promise (e.g. "payment received")
                lastNotes: (l.followUpNotes || []).map((n: any) => ({
                    staffName: n.staffName || 'Staff',
                    content: n.content,
                    // Full ISO datetime so AI knows EXACTLY when each note was written
                    date: toISOString(n.date),
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
