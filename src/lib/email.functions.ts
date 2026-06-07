import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendInvitationEmail,
  sendInviteeResponseToNedEmail,
  sendRequestConfirmationEmail,
  sendRequestUpdateEmail,
} from "./email.server";

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
    return sendRequestConfirmationEmail(data);
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

export const sendInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        hangoutTitle: z.string().min(1).max(300),
        pitch: z.string().max(2000).optional().nullable(),
        venue: z.string().max(300),
        when: z.string().max(200),
        inviteUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const html = wrap(
      `${data.name}, Ned wants to hang out`,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Ned's putting something on the calendar and would love for you to come along.</p>
       <div style="margin-top:6px;background:#F8F5EE;border-radius:16px;padding:16px 18px;font-size:14px;">
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">The plan</div>
         <div style="margin-top:2px;font-weight:600;color:#1E4D3D;">${esc(data.hangoutTitle)}</div>
         ${data.pitch ? `<div style="margin-top:8px;font-style:italic;">"${esc(data.pitch)}"</div>` : ""}
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">Where</div>
         <div style="margin-top:2px;">${esc(data.venue)}</div>
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">When</div>
         <div style="margin-top:2px;">${esc(data.when)}</div>
       </div>
       ${btn(data.inviteUrl, "Reply — Yes / Maybe / No")}`,
    );
    return sendViaResend({
      from: FROM,
      to: [data.to],
      bcc: [BCC],
      subject: `Ned invited you: ${data.hangoutTitle}`,
      html,
    });
  });

export const sendInviteeResponseToNed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        inviteeName: z.string().min(1).max(200),
        inviteeEmail: z.string().email(),
        response: z.enum(["accepted", "declined", "maybe"]),
        comment: z.string().max(2000).optional().nullable(),
        hangoutTitle: z.string().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const label = data.response === "accepted" ? "✅ Yes" : data.response === "maybe" ? "🤔 Maybe" : "❌ No";
    const html = wrap(
      `${data.inviteeName} replied: ${label}`,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${esc(data.inviteeName)} (${esc(data.inviteeEmail)}) responded to <strong>${esc(data.hangoutTitle)}</strong>.</p>
       <div style="margin-top:6px;background:#F8F5EE;border-radius:16px;padding:16px 18px;font-size:14px;">
         <div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Response</div>
         <div style="margin-top:2px;font-weight:600;color:#1E4D3D;">${label}</div>
         ${data.comment ? `<div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;">Comment</div><div style="margin-top:2px;font-style:italic;">"${esc(data.comment)}"</div>` : ""}
       </div>`,
    );
    return sendViaResend({
      from: FROM,
      to: [NED_INBOX],
      subject: `[Hangout] ${data.inviteeName} replied: ${label}`,
      html,
    });
  });
