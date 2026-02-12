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
            
            let numberOfMonths = 0;
            if (paymentFrequency === 'monthly') {
                numberOfMonths = n;
            } else if (paymentFrequency === 'weekly') {
                // Assuming 4 weeks per month for simplicity and alignment with business logic.
                numberOfMonths = n / 4;
            } else if (paymentFrequency === 'daily') {
                // Assuming 30 days per month for simplicity.
                numberOfMonths = n / 30;
            }
            
            const totalInterest = L * monthlyRateDecimal * numberOfMonths;
            totalRepayableAmount = L + totalInterest;
            instalmentAmount = totalRepayableAmount / n;

        } else { // 0 interest rate
            instalmentAmount = L / n;
            totalRepayableAmount = L;
        }
    }
    return { instalmentAmount, totalRepayableAmount };
}
