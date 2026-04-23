import { generateLoanAlerts } from './src/ai/flows/loan-alert-flow';

async function test() {
    try {
        console.log("Testing generateLoanAlerts...");
        const result = await generateLoanAlerts({
            userName: "Test",
            userRole: "staff",
            currentTime: new Date().toISOString(),
            loans: []
        });
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
