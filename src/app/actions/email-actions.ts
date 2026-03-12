'use server';

/**
 * @fileOverview Server actions for handling automated email delivery via Resend.
 */

import { generateEmailContent, type EmailEventInput } from '@/ai/flows/email-generation-flow';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_RGjGEBJf_JL8dayzB1Ji86iZbZ3CtrBFA');

/**
 * Sends an automated email to a customer using AI-generated content.
 * This function triggers the Resend API to deliver the personalized message.
 */
export async function sendAutomatedEmail(input: EmailEventInput & { recipientEmail: string }) {
  if (!input.recipientEmail) {
    console.error(`[AUTOMATION ERROR] Cannot send ${input.type} email: No recipient email provided.`);
    return { success: false, error: 'Recipient email is missing' };
  }

  try {
    // 1. Generate personalized content using Genkit AI
    const emailContent = await generateEmailContent({
      type: input.type,
      data: input.data
    });

    // 2. Deliver the email via Resend
    // IMPORTANT: Ensure 'pezeka.com' is verified in the Resend dashboard.
    const { data, error } = await resend.emails.send({
      from: 'Pezeka Credit <notifications@pezeka.com>',
      to: input.recipientEmail,
      subject: emailContent.subject,
      text: emailContent.body,
    });

    if (error) {
      console.error(`[RESEND API ERROR] Failed to deliver ${input.type} email to ${input.recipientEmail}:`, error);
      return { success: false, error };
    }

    console.log(`[AUTOMATION SUCCESS] ${input.type} email delivered to ${input.recipientEmail}. Message ID: ${data?.id}`);
    return { success: true, data };
  } catch (error) {
    console.error(`[CRITICAL SYSTEM FAILURE] Email automation flow crashed for ${input.type} to ${input.recipientEmail}:`, error);
    return { success: false, error };
  }
}
