import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendBulkMessageEmail } from "./email.server";

const ADMIN_PASSWORD_SERVER = process.env.ADMIN_PASSWORD ?? "nedate2026";
function assertAdmin(pw: string) {
  if (!pw || pw !== ADMIN_PASSWORD_SERVER) throw new Error("Unauthorized");
}

// --- contacts CRUD ---
export const listContacts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminPassword: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.adminPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("contacts")
      .select("id, name, email, created_at")
      .order("name");
    if (error) {
      console.error("[contacts] list", error);
      return { contacts: [] as { id: string; name: string; email: string; created_at: string }[] };
    }
    return { contacts: rows ?? [] };
  });

export const addContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminPassword: z.string().min(1).max(200),
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.adminPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    // Upsert-like behavior: if exists, ignore
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing) return { ok: true as const, alreadyExists: true };
    const { error } = await supabaseAdmin
      .from("contacts")
      .insert({ name: data.name, email });
    if (error) {
      console.error("[contacts] add", error);
      return { ok: false as const, error: "insert_failed" as const };
    }
    return { ok: true as const, alreadyExists: false };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminPassword: z.string().min(1).max(200), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.adminPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contacts").delete().eq("id", data.id);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

export const updateContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminPassword: z.string().min(1).max(200),
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.adminPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contacts")
      .update({ name: data.name, email: data.email.toLowerCase() })
      .eq("id", data.id);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

// --- bulk message ---
// Sends a message to all participants of a hangout matching the selected
// status filters. Invitee statuses: accepted/declined/maybe/pending.
// Join-request (attendee) statuses: approved/rejected/pending.
export const sendBulkMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminPassword: z.string().min(1).max(200),
        hangoutId: z.string().uuid(),
        subject: z.string().trim().min(1).max(300),
        body: z.string().trim().min(1).max(10000),
        inviteeStatuses: z.array(z.enum(["accepted", "declined", "maybe", "pending"])).default([]),
        joinStatuses: z.array(z.enum(["approved", "rejected", "pending"])).default([]),
        includeAttendees: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.adminPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: hangout } = await supabaseAdmin
      .from("requests")
      .select("id, title, pitch, hangout_status")
      .eq("id", data.hangoutId)
      .maybeSingle();
    if (!hangout) return { ok: false as const, error: "not_found" as const };
    if ((hangout as any).hangout_status !== "active") {
      return { ok: false as const, error: "hangout_not_active" as const };
    }

    const recipients = new Map<string, { name: string; email: string }>();

    // Invitees
    if (data.inviteeStatuses.length) {
      const { data: invs } = await supabaseAdmin
        .from("hangout_invitees")
        .select("name, email, response_status")
        .eq("hangout_id", data.hangoutId)
        .in("response_status", data.inviteeStatuses);
      for (const i of invs ?? []) {
        const key = i.email.toLowerCase();
        if (!recipients.has(key)) recipients.set(key, { name: i.name, email: i.email });
      }
    }

    // Join requests (people who asked to join this public hangout)
    if (data.joinStatuses.length) {
      const { data: joins } = await supabaseAdmin
        .from("requests")
        .select("requester_name, requester_email, request_status")
        .eq("parent_hangout_id", data.hangoutId)
        .eq("hangout_kind", "join_request")
        .in("request_status", data.joinStatuses);
      for (const j of joins ?? []) {
        if (!j.requester_email || !j.requester_name) continue;
        const key = j.requester_email.toLowerCase();
        if (!recipients.has(key)) recipients.set(key, { name: j.requester_name, email: j.requester_email });
      }
    }

    if (recipients.size === 0) {
      return { ok: false as const, error: "no_recipients" as const };
    }

    const title = hangout.title ?? hangout.pitch ?? "Hangout";
    const results = await Promise.allSettled(
      Array.from(recipients.values()).map((r) =>
        sendBulkMessageEmail({
          to: r.email,
          recipientName: r.name,
          hangoutTitle: title,
          subject: data.subject,
          body: data.body,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled" && (r.value as any).ok).length;
    return { ok: true as const, sent, total: recipients.size };
  });
