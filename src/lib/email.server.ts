const FROM = "Nedate <info@nedate.vivianchan.studio>";
const NED_INBOX = "nedyuen@yahoo.com.hk";
const BCC = NED_INBOX;
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

type SendResult = Promise<{ ok: true } | { ok: false; error: string }>;

async function sendViaResend(payload: Record<string, unknown>): SendResult {
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
  return `<p style="margin:24px 0 4px;"><a href="${esc(href)}" style="display:inline-block;background:#1E4D3D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:500;">${esc(label)}</a></p>
  <p style="margin:8px 0 0;font-size:12px;color:#666;">Or copy: ${esc(href)}</p>`;
}

export function sendRequestConfirmationEmail(data: {
  to: string;
  name: string;
  pitch: string;
  venue: string;
  when: string;
  trackingUrl: string;
}): SendResult {
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
}

export function sendRequestUpdateEmail(data: {
  to: string;
  name: string;
  status: "approved" | "rejected";
  comment?: string | null;
  venue: string;
  when: string;
  trackingUrl: string;
}): SendResult {
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
}

export function sendInvitationEmail(data: {
  to: string;
  name: string;
  hangoutTitle: string;
  pitch?: string | null;
  venue: string;
  when: string;
  inviteUrl: string;
}): SendResult {
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
}

export function sendInviteeResponseToNedEmail(data: {
  inviteeName: string;
  inviteeEmail: string;
  response: "accepted" | "declined" | "maybe";
  comment?: string | null;
  hangoutTitle: string;
}): SendResult {
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
}

function diffBlock(label: string, current: string, proposed: string) {
  return `<div style="margin-top:12px;background:#F8F5EE;border-radius:14px;padding:14px 16px;font-size:13px;">
    <div style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">${esc(label)}</div>
    <div style="margin-top:4px;color:#a04040;text-decoration:line-through;">${esc(current)}</div>
    <div style="margin-top:2px;color:#1E4D3D;font-weight:600;">${esc(proposed)}</div>
  </div>`;
}

export function sendChangeProposedEmail(data: {
  to: string;
  recipientName: string;
  proposerName: string;
  hangoutTitle: string;
  diffs: { label: string; current: string; proposed: string }[];
  comment?: string | null;
  actionUrl: string;
}): SendResult {
  const diffsHtml = data.diffs.map((d) => diffBlock(d.label, d.current, d.proposed)).join("");
  const note = data.comment
    ? `<div style="margin-top:14px;background:#FBF2DC;border:1px solid #F0DDA8;border-radius:14px;padding:12px 14px;font-size:13px;"><div style="color:#1E4D3D;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">A note from ${esc(data.proposerName)}</div><div style="margin-top:4px;">${esc(data.comment)}</div></div>`
    : "";
  const html = wrap(
    `${data.proposerName} wants to change the plan`,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.55;">Heads up ${esc(data.recipientName)} — a change has been proposed for <strong>${esc(data.hangoutTitle)}</strong>. Open the page to accept or reject.</p>
     ${diffsHtml}
     ${note}
     ${btn(data.actionUrl, "Review the change")}`,
  );
  return sendViaResend({
    from: FROM,
    to: [data.to],
    bcc: [BCC],
    subject: `Change proposed: ${data.hangoutTitle}`,
    html,
  });
}

export function sendChangeDecisionEmail(data: {
  to: string;
  proposerName: string;
  responderName: string;
  hangoutTitle: string;
  decision: "approved" | "rejected";
  comment?: string | null;
  actionUrl: string;
}): SendResult {
  const approved = data.decision === "approved";
  const title = approved ? `Your change was accepted ✨` : `Your change was declined`;
  const intro = approved
    ? `${data.responderName} accepted your proposed change for ${data.hangoutTitle}. Updated details are live.`
    : `${data.responderName} declined your proposed change for ${data.hangoutTitle}. The original plan stands.`;
  const note = data.comment
    ? `<div style="margin-top:14px;background:#FBF2DC;border:1px solid #F0DDA8;border-radius:14px;padding:12px 14px;font-size:13px;"><div style="color:#1E4D3D;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Their note</div><div style="margin-top:4px;">${esc(data.comment)}</div></div>`
    : "";
  const html = wrap(
    title,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.55;">${esc(intro)}</p>
     ${note}
     ${btn(data.actionUrl, "View the hangout")}`,
  );
  return sendViaResend({
    from: FROM,
    to: [data.to],
    subject: approved ? `Accepted: ${data.hangoutTitle}` : `Declined: ${data.hangoutTitle}`,
    html,
  });
}

export function sendReconfirmAttendanceEmail(data: {
  to: string;
  recipientName: string;
  hangoutTitle: string;
  oldWhen: string;
  newWhen: string;
  actionUrl: string;
}): SendResult {
  const html = wrap(
    `Can you still make it?`,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.55;">Hi ${esc(data.recipientName)} — the time for <strong>${esc(data.hangoutTitle)}</strong> changed. Please reconfirm whether you can come.</p>
     ${diffBlock("When", data.oldWhen, data.newWhen)}
     ${btn(data.actionUrl, "Reconfirm — Yes / Maybe / No")}`,
  );
  return sendViaResend({
    from: FROM,
    to: [data.to],
    bcc: [BCC],
    subject: `Reconfirm: ${data.hangoutTitle}`,
    html,
  });
}
