import { generateLoanAlerts } from './src/ai/flows/loan-alert-flow';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const result = await generateLoanAlerts({
            userName: "Test User",
            userRole: "staff",
            currentTime: new Date().toISOString(),
            loans: []
        });
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
