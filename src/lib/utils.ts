import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAmortization(principal: number, monthlyRatePercent: number, numberOfInstalments: number, paymentFrequency: 'daily' | 'weekly' | 'monthly') {
    const L = Number(principal) || 0;
    const monthlyRate = Number(monthlyRatePercent) || 0;
    const n = Number(numberOfInstalments) || 0;
    let instalmentAmount = 0;
    let totalRepayableAmount = 0;

    if (L > 0 && n > 0) {
        if (monthlyRate > 0) {
            let r = 0; // periodic interest rate
            const monthlyRateDecimal = monthlyRate / 100;
            if (paymentFrequency === 'monthly') {
                r = monthlyRateDecimal;
            } else if (paymentFrequency === 'weekly') {
                // Convert monthly rate to weekly rate
                r = (monthlyRateDecimal * 12) / 52;
            } else if (paymentFrequency === 'daily') {
                // Convert monthly rate to daily rate
                r = (monthlyRateDecimal * 12) / 365;
            }

            if (r > 0) {
                // Amortization formula: P = L * [r(1+r)^n] / [(1+r)^n - 1]
                const numerator = r * Math.pow(1 + r, n);
                const denominator = Math.pow(1 + r, n) - 1;
                instalmentAmount = L * (numerator / denominator);
                totalRepayableAmount = instalmentAmount * n;
            }
        } else { // 0 interest rate
            instalmentAmount = L / n;
            totalRepayableAmount = L;
        }
    }
    return { instalmentAmount, totalRepayableAmount };
}
