'use server';

import { runCustomerAssistant } from '@/ai/flows/customer-assistant-flow';

export async function askCustomerAI(payload: {
    message: string;
    history?: { role: 'user' | 'model'; content: string }[];
    customerName: string;
    customerProfile?: any;
    customerLoans?: any[];
    loanProducts: any[];
    referralCode?: string;
    applicationDraft?: Record<string, any> | null;
}) {
    try {
        console.log('[CUSTOMER AI]: Processing message for', payload.customerName);
        const response = await runCustomerAssistant({
            message: payload.message,
            history: payload.history,
            customerName: payload.customerName,
            customerProfile: payload.customerProfile,
            customerLoans: payload.customerLoans,
            loanProducts: payload.loanProducts,
            referralCode: payload.referralCode,
            applicationDraft: payload.applicationDraft || undefined,
            currentTime: new Date().toISOString(),
        });
        return { success: true, response };
    } catch (error: any) {
        console.error('[CUSTOMER AI ERROR]:', error);
        return { success: false, error: error.message || String(error) || 'Internal Genkit Error' };
    }
}
