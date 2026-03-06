
'use server';

/**
 * @fileOverview Server actions for handling automated email delivery.
 */

import { generateEmailContent, type EmailEventInput } from '@/ai/flows/email-generation-flow';

/**
 * Sends an automated email to a customer using AI-generated content.
 * In a production environment, this would call a service like Resend, SendGrid, or Mailgun.
 */
export async function sendAutomatedEmail(input: EmailEventInput & { recipientEmail: string }) {
  try {
    // 1. Generate personalized content using Genkit
    const emailContent = await generateEmailContent({
      type: input.type,
      data: input.data
    });

    // 2. Log for automation tracking (Placeholder for real SMTP/API call)
    console.log(`[AUTOMATION] Email Triggered: ${input.type}`);
    console.log(`[RECIPIENT] ${input.recipientEmail}`);
    console.log(`[SUBJECT] ${emailContent.subject}`);
    console.log(`[CONTENT] \n${emailContent.body}`);

    /**
     * NOTE TO DEVELOPER: To enable real delivery, install 'resend' and use:
     * const resend = new Resend(process.env.RESEND_API_KEY);
     * await resend.emails.send({
     *   from: 'Pezeka Credit <notifications@pezeka.com>',
     *   to: input.recipientEmail,
     *   subject: emailContent.subject,
     *   text: emailContent.body
     * });
     */

    return { success: true };
  } catch (error) {
    console.error('Failed to send automated email:', error);
    return { success: false, error };
  }
}
