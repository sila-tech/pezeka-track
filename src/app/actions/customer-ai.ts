'use server';

import { startChat } from '@/lib/ai';

const FIELD_QUESTIONS: Record<string, string> = {
  loanType:            'Which loan type? Quick Pesa / Salary Advance / Business Loan / Logbook Loan',
  principalAmount:     'How much would you like to borrow (KES)?',
  paymentFrequency:    'Repayment frequency: daily, weekly, or monthly?',
  numberOfInstalments: 'How many instalments? (1 month daily≈30, weekly≈4, monthly≈1)',
  customerPhone:       'What phone number should we use?',
  physicalAddress:     'What is your physical/residential address?',
  employmentType:      'Employment type: Employed / Self-Employed / Business Owner / Other',
  monthlyIncomeRange:  'Monthly income range: Below 10k / 10k–30k / 30k–60k / 60k+',
  idNumber:            'Your National ID number?',
  employerName:        "Employer's name?",
  jobPosition:         'Job position/title?',
  workLocation:        'Work location/town?',
  hrContact:           'HR contact phone number?',
  hrEmail:             'HR contact email?',
  vehicleRegistration: 'Vehicle registration plate?',
  vehicleMake:         'Vehicle make/brand (e.g. Toyota)?',
  vehicleModel:        'Vehicle model (e.g. Fielder)?',
  vehicleYear:         'Year of manufacture?',
  vehicleOwner:        'Name on logbook?',
  vehicleOwnership:    'Self-owned or under finance/hire-purchase?',
  businessName:        'Business name?',
  businessType:        'Business type/industry?',
  monthlyRevenue:      'Estimated monthly revenue?',
};

function getNextMissingField(draft: Record<string, any>): string | null {
  const base = ['loanType','principalAmount','paymentFrequency','numberOfInstalments',
                 'customerPhone','physicalAddress','employmentType','monthlyIncomeRange','idNumber'];
  for (const f of base) { if (!draft[f] && draft[f] !== 0) return f; }

  const lt = (draft.loanType || '').toLowerCase();
  if (lt.includes('salary')) {
    for (const f of ['employerName','jobPosition','workLocation','hrContact','hrEmail'])
      { if (!draft[f]) return f; }
  }
  if (lt.includes('logbook')) {
    for (const f of ['vehicleRegistration','vehicleMake','vehicleModel','vehicleYear','vehicleOwner','vehicleOwnership'])
      { if (!draft[f]) return f; }
  }
  if (lt.includes('business') || lt.includes('individual')) {
    for (const f of ['businessName','businessType','monthlyRevenue'])
      { if (!draft[f]) return f; }
  }
  return null;
}

function extractField(field: string, msg: string, draft: Record<string, any>): string | number | null {
  const m = msg.trim();
  const lo = m.toLowerCase();

  switch (field) {
    case 'loanType': {
      if (/quick|emergency/.test(lo)) return 'Quick Pesa (1 Month)';
      if (/salary/.test(lo)) return 'Salary Advance';
      if (/business|individual/.test(lo)) return 'Individual & Business Loan';
      if (/logbook|log book/.test(lo)) return 'Logbook Loan';
      return null;
    }
    case 'principalAmount': {
      const km = m.match(/(\d+(?:\.\d+)?)\s*k/i);
      if (km) return Math.round(parseFloat(km[1]) * 1000);
      const nm = m.match(/[\d,]+/);
      if (nm) return parseInt(nm[0].replace(/,/g, ''), 10);
      return null;
    }
    case 'paymentFrequency': {
      if (/daily|day/.test(lo)) return 'daily';
      if (/weekly|week/.test(lo)) return 'weekly';
      if (/monthly|month/.test(lo)) return 'monthly';
      return null;
    }
    case 'numberOfInstalments': {
      const freq = (draft.paymentFrequency || '').toLowerCase();
      const monthMatch = lo.match(/(\d+)\s*month/);
      if (monthMatch) {
        const months = parseInt(monthMatch[1], 10);
        if (freq === 'daily')  return months * 30;
        if (freq === 'weekly') return months * 4;
        return months;
      }
      const numMatch = m.match(/\d+/);
      if (numMatch) return parseInt(numMatch[0], 10);
      return null;
    }
    case 'customerPhone': {
      const pm = m.match(/(?:07|01|\+254)\d{8}/);
      if (pm) return pm[0];
      if (/file|system|same|provided|on it|use (it|that)/.test(lo)) return '__KNOWN__';
      return null;
    }
    case 'monthlyIncomeRange': {
      const clean = lo.replace(/[,\s]/g, '');
      const n = parseInt(clean.match(/\d+/)?.[0] || '', 10);
      if (!isNaN(n)) {
        if (n < 10000)  return 'Below 10,000';
        if (n <= 30000) return '10,000–30,000';
        if (n <= 60000) return '30,000–60,000';
        return '60,000+';
      }
      if (/below|under|less/.test(lo)) return 'Below 10,000';
      if (/60\+|above 60|over 60/.test(lo)) return '60,000+';
      return null;
    }
    case 'employmentType': {
      if (/self.?employ/.test(lo)) return 'Self-Employed';
      if (/business owner/.test(lo)) return 'Business Owner';
      if (/employed/.test(lo)) return 'Employed';
      if (/other/.test(lo)) return 'Other';
      return null;
    }
    case 'idNumber': {
      const id = m.match(/\d{7,9}/);
      return id ? id[0] : null;
    }
    default:
      return m.length > 0 ? m : null;
  }
}

function isClosingMessage(msg: string): boolean {
  const cleaned = msg.trim().toLowerCase().replace(/[!.,😊☀️👍🙏]/g, '').trim();
  const CLOSERS = new Set([
    'alright','okay','ok','thanks','thank you','noted','cool','got it','understood',
    'fine','great','perfect','nice','awesome','sure','sounds good','no problem',
    'cheers','will do','done','👍','🙏','that\'s all','thats all','nothing else',
    'nothing else thanks', 'no thanks', 'goodbye', 'bye'
  ]);
  return CLOSERS.has(cleaned) || cleaned.length <= 12 && CLOSERS.has(cleaned.replace(/\s+/g, ' '));
}

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
        const currentTime = new Date().toISOString();
        const hour = new Date().getHours();
        const greetingPrefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        
        const knownPhone    = payload.customerProfile?.phone || '';
        const knownIdNumber = payload.customerProfile?.idNumber || '';
        const isFirst       = (payload.history || []).length <= 1; // Hello msg is usually 1st

        // ── Draft management ──────────────────────────
        const draft: Record<string, any> = { ...(payload.applicationDraft || {}) };
        delete draft.nextExpected;

        if (!draft.customerPhone && knownPhone)    draft.customerPhone = knownPhone;
        if (!draft.idNumber      && knownIdNumber) draft.idNumber      = knownIdNumber;

        const hasDraft  = !!draft.loanType;
        let   nextField = hasDraft ? getNextMissingField(draft) : null;

        if (hasDraft && nextField) {
            const extracted = extractField(nextField, payload.message, draft);
            if (extracted === '__KNOWN__' && nextField === 'customerPhone') {
                draft.customerPhone = knownPhone;
            } else if (extracted !== null && extracted !== '__KNOWN__') {
                draft[nextField] = extracted;
            }
            nextField = getNextMissingField(draft);
        }

        const allDone = hasDraft && nextField === null;

        // ── Short-circuit: closing message ─────────────────────────
        if (!hasDraft && isClosingMessage(payload.message)) {
            const pezekaFacts = [
                'At Pezeka, loans are processed within 24 hours — speed matters to us! ⚡',
                'Pezeka offers flexible repayment plans tailored to your schedule. 📅',
                'Thousands of Kenyans trust Pezeka for fast, fair credit solutions. 🏆',
                'With Pezeka, your loan history builds your credit limit over time. 📈',
            ];
            const fact = pezekaFacts[Math.floor(Math.random() * pezekaFacts.length)];
            const refCode = payload.referralCode || 'INVITE';
            return { 
                success: true, 
                response: `Have a wonderful day! ☀️\n\n💡 ${fact}\n\n🌟 Earn cash by referring friends to Pezeka! Your personal referral link:\n👉 pezeka.com/${refCode}`
            };
        }

        // ── AI Generation ──────────────────────────
        const loanSummary = (payload.customerLoans || []).slice(0, 5).map((loan: any) => {
            const bal = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
            return `• #${loan.loanNumber} (${loan.loanType}): ${loan.status} | Bal KES ${bal}`;
        }).join('\n') || 'No loans.';

        const systemPrompt = `You are NOVA — a premium, warm, and highly efficient Neural Assistant for Pezeka Credit Ltd Kenya.
Customer: ${payload.customerName} | Time: ${currentTime}
Phone on file: ${knownPhone || 'N/A'} | ID on file: ${knownIdNumber || 'N/A'}

LOANS:\n${loanSummary}

PRODUCTS: Quick Pesa(10% int, 1mo) | Salary Advance(10%) | Business Loan(5%) | Logbook Loan(10%)
FEES: All loans deduct 10% appraisal upfront. Logbook also: KES 1,500 in-charge + KES 1,500 discharge + KES 10,000 tracker.

${hasDraft ? `=== LOAN APPLICATION IN PROGRESS ===
Collected so far: ${JSON.stringify(draft)}
${allDone
  ? `ALL FIELDS DONE. Show this numbered summary and ask customer to reply YES to confirm:\n${Object.entries(draft).filter(([,v])=>v).map(([k,v],i)=>`${i+1}. ${k}: ${v}`).join('\n')}`
  : `NEXT FIELD: "${nextField}" — Ask ONLY: "${FIELD_QUESTIONS[nextField!] || nextField}"`}` : ''}

${allDone ? `WHEN CUSTOMER REPLIES YES: output exactly:
[APPLICATION_READY]
${JSON.stringify({
  loanType: draft.loanType || '',
  principalAmount: draft.principalAmount || 0,
  numberOfInstalments: draft.numberOfInstalments || 1,
  paymentFrequency: draft.paymentFrequency || 'monthly',
  customerPhone: draft.customerPhone || '',
  physicalAddress: draft.physicalAddress || '',
  employmentType: draft.employmentType || '',
  monthlyIncomeRange: draft.monthlyIncomeRange || '',
  idNumber: draft.idNumber || '',
  employerName: draft.employerName || '',
  jobPosition: draft.jobPosition || '',
  workLocation: draft.workLocation || '',
  hrContact: draft.hrContact || '',
  hrEmail: draft.hrEmail || '',
  vehicleRegistration: draft.vehicleRegistration || '',
  vehicleMake: draft.vehicleMake || '',
  vehicleModel: draft.vehicleModel || '',
  vehicleYear: draft.vehicleYear || '',
  vehicleOwnership: draft.vehicleOwnership || '',
  vehicleOwner: draft.vehicleOwner || '',
}, null, 2)}
[/APPLICATION_READY]` : ''}

- RULES:
${isFirst ? `Greet: "${greetingPrefix}, ${payload.customerName}! 😊"` : 'NO greeting.'}
- Style: warm, concise. Use ✅ 💰 📅 emojis.
- Loan application start: if customer wants to apply and no draft yet, ask for loan type first. Then emit: [APP_STATE]{"loanType":"<mapped value>"}[/APP_STATE]`;

        const chat = await startChat(payload.history || [], systemPrompt);
        const result = await chat.sendMessage(payload.message);
        const response = await result.response;
        let text = response.text();

        if (hasDraft) {
            text += `\n[SERVER_DRAFT]${JSON.stringify(draft)}[/SERVER_DRAFT]`;
        }

        return { success: true, response: text };
    } catch (error: any) {
        console.error('[CUSTOMER AI ERROR]:', error);
        return { success: false, error: 'Nova is momentarily resting. Please try again in a few seconds.' };
    }
}
