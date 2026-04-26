'use server';

import { startChat } from '@/lib/ai';

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

export async function getStaffAIAdvice(loans: any[], userContext: { name: string, role: 'staff' | 'finance' }) {
    try {
        if (!loans || loans.length === 0) return { success: true, alerts: [] };

        const currentTime = new Date().toISOString();
        let loansText = '';
        for (const loan of loans) {
            loansText += `\n─── Loan ${loan.loanNumber} | ${loan.customerName} | Arrears: KES ${loan.arrearsBalance || 0} ───\n`;
            for (const note of (loan.followUpNotes || [])) {
                loansText += `  [Written: ${toISOString(note.date)}] ${note.staffName || 'Staff'} wrote: "${note.content}"\n`;
            }
        }

        const systemPrompt = `You are an AI Credit Assistant for Pezeka Credit Ltd.
Current User: ${userContext.name}
Role: ${userContext.role}
Current Date & Time (ISO 8601): ${currentTime}

CONTEXT:
- If MORNING (before 12 PM): Be encouraging. Say "Good morning [Name]... today seems to be a great day".
- If AFTERNOON (after 12 PM): Acknowledge work done. Say "Good afternoon [Name]... here is what has been accomplished".

TEMPORAL PROMISE DETECTION:
Identify if a customer committed to pay at a specific time that has now PASSED.
Anchor deadlines to the note's write date, not today's date.
If a LATER note says "payment received", the promise was KEPT.

OUTPUT FORMAT:
Return ONLY a JSON object with:
{
  "greeting": "...",
  "summary": "...",
  "alerts": [
    { "loanNumber": "...", "title": "...", "message": "...", "urgency": "low|medium|high" }
  ],
  "teamProgress": ["..."] (Optional, for Finance only)
}

DATA:`;

        const taskPrompt = `Analyze these loans and notes:\n${loansText}`;
        const responseText = await generateContent(taskPrompt, systemPrompt);
        const text = responseText;
        
        // Clean the text to find JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return { success: true, ...data };
        }

        return { success: true, greeting: `Hello ${userContext.name}`, summary: "Analysis complete.", alerts: [] };
    } catch (error: any) {
        console.error("[AI ADVICE ERROR]:", error);
        return { success: false, alerts: [], error: 'Failed to generate AI advice' };
    }
}
