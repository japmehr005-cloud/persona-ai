const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface OtpDeliveryContext {
  toEmail: string;
  code: string;
  merchant: string;
  amount: number;
}

export interface OtpDeliveryResult {
  channel: "email" | "console";
  /** Only populated when no real delivery channel is configured, so the
   * demo UI can display the code directly instead of requiring SMTP setup. */
  demoCode?: string;
}

/**
 * Delivers a CB-OTP code to the customer. Uses Resend's HTTP API directly
 * (no SDK dependency needed for a single call) when RESEND_API_KEY is
 * configured. Falls back to a server-console log for local development —
 * in that case the code is also returned so the demo UI can surface it,
 * clearly labeled as a demo/dev fallback rather than a security bypass.
 */
export async function deliverOtp(context: OtpDeliveryContext): Promise<OtpDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[Persona AI][dev] CB-OTP code for ${context.toEmail} (tx: ${context.merchant}, ${context.amount}): ${context.code}`
    );
    return { channel: "console", demoCode: context.code };
  }

  const from = process.env.OTP_EMAIL_FROM || "Persona AI <security@personaai.ai>";

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: context.toEmail,
      subject: "Your Persona AI verification code",
      text: `Your verification code is ${context.code}. It expires in 5 minutes and is bound to your ${context.merchant} transaction. If you didn't request this, contact support immediately.`,
    }),
  });

  if (!response.ok) {
    console.error(`[Persona AI] Failed to send OTP email: ${response.status} ${await response.text()}`);
    return { channel: "console", demoCode: context.code };
  }

  return { channel: "email" };
}
