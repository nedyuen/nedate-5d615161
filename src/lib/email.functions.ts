import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FROM = "Nedate <info@nedate.vivianchan.studio>";
const BCC = "nedyuen@yahoo.com.hk";
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

async function sendViaResend(payload: Record<string, unknown>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.error("[email] Missing LOVABLE_API_KEY or RESEND_API_KEY");
    return { ok: false, error: "email_not_configured" };
  }
  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[email] Resend send failed", res.status, text);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function wrap(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:22px;color:#1E4D3D;font-weight:600;letter-spacing:-0.01em;">Nedate</div>
      <div style="margin-top:28px;background:#fff;border:1px solid #ece7da;border-radius:24px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#1E4D3D;">${esc(title)}</h1>
        ${bodyHtml}
      </div>
      <div style="margin-top:20px;font-size:12px;color:#666;text-align:center;">Sent with love by Nedate</div>
    </div>
  </body></html>`;
}

function btn(href: string, label: string) {
  return `<p style="margin:24px 0 4px;"><a href="${href}" style="display:inline-block;background:#1E4D3D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:500;">${esc(label)}</a></p>
  <p style="margin:8px 0 0;font-size:12px;color:#666;">Or copy: ${esc(href)}</p>`;
}

export const sendRequestConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        pitch: z.string().max(2000),
        venue: z.string().max(300),
        when: z.string().max(200),
        trackingUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const html = wrap(
      `Hey ${data.name}, your request is in 🌿`,
      `<p style="margin:0 0 14px;color:#222;font-size:15px;line-height:1.55;">Ned just got your invite. You'll hear back soon — promise.</p>
       <div style="margin-top:18px;background:#F8F5EE;border-radius:16px;padding:16px 18px;font-size:14px;color:#222;">
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Where</div>
         <div style="margin-top:2px;">${esc(data.venue)}</div>
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">When</div>
         <div style="margin-top:2px;">${esc(data.when)}</div>
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">Your pitch</div>
         <div style="margin-top:2px;font-style:italic;">"${esc(data.pitch)}"</div>
       </div>
       ${btn(data.trackingUrl, "Track your request")}`,
    );
    return sendViaResend({
      from: FROM,
      to: [data.to],
      bcc: [BCC],
      subject: "Your Nedate request is in",
      html,
    });
  });

export const sendRequestUpdate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        status: z.enum(["approved", "rejected"]),
        comment: z.string().max(2000).optional().nullable(),
        venue: z.string().max(300),
        when: z.string().max(200),
        trackingUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const approved = data.status === "approved";
    const title = approved ? `Ned said yes ✨` : `Not this time, ${data.name}`;
    const intro = approved
      ? `It's a date. Ned will reach out personally to lock in the details.`
      : `Ned can't make this one happen. Don't take it personally — try another idea anytime.`;
    const note = data.comment
      ? `<div style="margin-top:18px;background:#FBF2DC;border:1px solid #F0DDA8;border-radius:16px;padding:16px 18px;font-size:14px;color:#222;">
           <div style="color:#1E4D3D;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">A note from Ned</div>
           <div style="margin-top:6px;">${esc(data.comment)}</div>
         </div>`
      : "";
    const html = wrap(
      title,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${esc(intro)}</p>
       ${note}
       <div style="margin-top:18px;background:#F8F5EE;border-radius:16px;padding:16px 18px;font-size:14px;">
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Where</div>
         <div style="margin-top:2px;">${esc(data.venue)}</div>
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">When</div>
         <div style="margin-top:2px;">${esc(data.when)}</div>
       </div>
       ${btn(data.trackingUrl, "View your request")}`,
    );
    return sendViaResend({
      from: FROM,
      to: [data.to],
      bcc: [BCC],
      subject: approved ? "Ned said yes ✨" : "An update on your Nedate request",
      html,
    });
  });
