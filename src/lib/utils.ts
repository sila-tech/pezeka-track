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
            const monthlyRateDecimal = monthlyRate / 100;
            let periodicRate = 0;
            if (paymentFrequency === 'monthly') {
                periodicRate = monthlyRateDecimal;
            } else if (paymentFrequency === 'weekly') {
                // Convert monthly rate to weekly rate
                periodicRate = (monthlyRateDecimal * 12) / 52;
            } else if (paymentFrequency === 'daily') {
                // Convert monthly rate to daily rate
                periodicRate = (monthlyRateDecimal * 12) / 365;
            }
            
            // Simple Interest (Flat Rate): Total Interest = Principal * periodic_rate * number_of_periods
            const totalInterest = L * periodicRate * n;
            totalRepayableAmount = L + totalInterest;
            instalmentAmount = totalRepayableAmount / n;

        } else { // 0 interest rate
            instalmentAmount = L / n;
            totalRepayableAmount = L;
        }
    }
    return { instalmentAmount, totalRepayableAmount };
}
