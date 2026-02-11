import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAmortization(principal: number, annualRatePercent: number, numberOfInstalments: number, paymentFrequency: 'daily' | 'weekly' | 'monthly') {
    const L = Number(principal);
    const annualRate = Number(annualRatePercent);
    const n = Number(numberOfInstalments);
    let instalmentAmount = 0;
    let totalRepayableAmount = 0;

    if (L > 0 && n > 0) {
        if (annualRate > 0) {
            let r = 0; // periodic interest rate
            if (paymentFrequency === 'monthly') {
                r = annualRate / 100 / 12;
            } else if (paymentFrequency === 'weekly') {
                r = annualRate / 100 / 52;
            } else if (paymentFrequency === 'daily') {
                r = annualRate / 100 / 365;
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
