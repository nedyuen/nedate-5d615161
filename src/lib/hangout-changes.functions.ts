import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendChangeProposedEmail,
  sendChangeDecisionEmail,
  sendReconfirmAttendanceEmail,
} from "./email.server";

const SLUG_RE = /^[a-z0-9]{8,32}$/i;
const ADMIN_PASSWORD_SERVER = process.env.ADMIN_PASSWORD ?? "nedate2026";
const ORIGIN = "https://nedate.lovable.app";

// ---- Field whitelist for snapshots (must match plan) ----
const MUTABLE_KEYS = [
  "start_time",
  "end_time",
  "venue_id",
  "custom_venue_name",
  "custom_venue_location",
  "custom_venue_image_url",
  "title",
  "pitch",
  "category",
] as const;
type MutableKey = (typeof MUTABLE_KEYS)[number];

const TIME_KEYS: MutableKey[] = ["start_time", "end_time"];

const changesSchema = z
  .object({
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    venue_id: z.string().uuid().nullable().optional(),
    custom_venue_name: z.string().max(300).nullable().optional(),
    custom_venue_location: z.string().max(500).nullable().optional(),
    custom_venue_image_url: z.string().max(2000).nullable().optional(),
    title: z.string().min(1).max(300).optional(),
    pitch: z.string().max(4000).nullable().optional(),
    category: z.string().min(1).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_changes" });

const actorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slug"), slug: z.string().regex(SLUG_RE) }),
  z.object({
    kind: z.literal("admin"),
    adminPassword: z.string().min(1).max(200),
    hangoutId: z.string().uuid(),
  }),
]);
type ActorInput = z.infer<typeof actorSchema>;

// =========================================================
// Auth layer: resolveActor → active participant
// =========================================================
async function resolveActor(input: ActorInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (input.kind === "slug") {
    const { data } = await supabaseAdmin
      .from("hangout_participants")
      .select("*")
      .eq("slug", input.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) throw new Error("unauthorized");
    return data;
  }
  if (input.adminPassword !== ADMIN_PASSWORD_SERVER) throw new Error("unauthorized");
  const { data } = await supabaseAdmin
    .from("hangout_participants")
    .select("*")
    .eq("hangout_id", input.hangoutId)
    .eq("type", "ned")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) throw new Error("unauthorized");
  return data;
}

// =========================================================
// Helpers
// =========================================================
const TZ = "Europe/London";
function fmtWhen(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "TBD";
  const s = new Date(start);
  const base = `${s.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })} · ${s.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: TZ })}`;
  if (!end) return base;
  return `${base} – ${new Date(end).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: TZ })}`;
}

function venueLabel(h: {
  venue_id: string | null;
  custom_venue_name: string | null;
  custom_venue_location: string | null;
  venueRow?: { name: string; location: string | null } | null;
}) {
  if (h.venue_id && h.venueRow) {
    return h.venueRow.name + (h.venueRow.location ? ` · ${h.venueRow.location}` : "");
  }
  if (h.custom_venue_name) {
    return h.custom_venue_name + (h.custom_venue_location ? ` · ${h.custom_venue_location}` : "");
  }
  return "TBD";
}

function participantUrl(p: { type: string; slug: string | null }) {
  if (!p.slug) return `${ORIGIN}/admin`;
  if (p.type === "invitee") return `${ORIGIN}/i/${p.slug}`;
  return `${ORIGIN}/r/${p.slug}`; // requester + attendee
}

function snapshotDiffs(
  oldSnap: Record<string, any>,
  newSnap: Record<string, any>,
  venues: { current: { name: string; location: string | null } | null; proposed: { name: string; location: string | null } | null },
) {
  const out: { key: string; label: string; current: string; proposed: string }[] = [];
  for (const k of Object.keys(newSnap)) {
    if (k === "start_time" || k === "end_time") continue; // combined below
    if (k.startsWith("venue_id") || k.startsWith("custom_venue")) continue; // combined below
    const cur = oldSnap[k];
    const next = newSnap[k];
    if (cur === next) continue;
    out.push({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      current: cur == null ? "—" : String(cur),
      proposed: next == null ? "—" : String(next),
    });
  }
  if ("start_time" in newSnap || "end_time" in newSnap) {
    out.unshift({
      key: "when",
      label: "When",
      current: fmtWhen(oldSnap.start_time, oldSnap.end_time),
      proposed: fmtWhen(newSnap.start_time ?? oldSnap.start_time, newSnap.end_time ?? oldSnap.end_time),
    });
  }
  const venueChanged =
    "venue_id" in newSnap ||
    "custom_venue_name" in newSnap ||
    "custom_venue_location" in newSnap;
  if (venueChanged) {
    const curLabel = venues.current
      ? venues.current.name + (venues.current.location ? ` · ${venues.current.location}` : "")
      : oldSnap.custom_venue_name
        ? `${oldSnap.custom_venue_name}${oldSnap.custom_venue_location ? ` · ${oldSnap.custom_venue_location}` : ""}`
        : "TBD";
    const proposedHasExisting = newSnap.venue_id !== undefined && newSnap.venue_id !== null;
    const proposedLabel = proposedHasExisting && venues.proposed
      ? venues.proposed.name + (venues.proposed.location ? ` · ${venues.proposed.location}` : "")
      : (newSnap.custom_venue_name ?? oldSnap.custom_venue_name ?? "TBD") +
        ((newSnap.custom_venue_location ?? oldSnap.custom_venue_location)
          ? ` · ${newSnap.custom_venue_location ?? oldSnap.custom_venue_location}`
          : "");
    out.push({ key: "venue", label: "Where", current: curLabel, proposed: proposedLabel });
  }
  return out;
}

// =========================================================
// Read: participant context (powers /r, /i, admin per-hangout)
// =========================================================
export const getParticipantContext = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ actor: actorSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let viewer;
    try {
      viewer = await resolveActor(data.actor);
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }

    const { data: hangout } = await supabaseAdmin
      .from("requests")
      .select(
        "id, slug, category, title, pitch, start_time, end_time, hangout_kind, hangout_status, request_status, admin_comment, request_message, requester_name, venue_id, custom_venue_name, custom_venue_location, custom_venue_image_url, visibility, venue:venues(name, location, image_url)",
      )
      .eq("id", viewer.hangout_id)
      .maybeSingle();
    if (!hangout) return { ok: false as const, error: "hangout_not_found" as const };

    const { data: participants } = await supabaseAdmin
      .from("hangout_participants")
      .select("id, type, slug, display_name, email, is_active, needs_reconfirmation")
      .eq("hangout_id", viewer.hangout_id)
      .eq("is_active", true);

    const { data: proposals } = await supabaseAdmin
      .from("hangout_change_requests")
      .select("*, proposer:hangout_participants!hangout_change_requests_proposed_by_participant_id_fkey(id, type, display_name), responder:hangout_participants!hangout_change_requests_responder_participant_id_fkey(id, type, display_name)")
      .eq("hangout_id", viewer.hangout_id)
      .order("created_at", { ascending: false });

    const pendingProposal = (proposals ?? []).find((p: any) => p.status === "pending") ?? null;
    const history = (proposals ?? []).filter((p: any) => p.status !== "pending");

    return {
      ok: true as const,
      viewer: {
        id: viewer.id,
        type: viewer.type,
        slug: viewer.slug,
        display_name: viewer.display_name,
        needs_reconfirmation: viewer.needs_reconfirmation,
      },
      hangout,
      participants: participants ?? [],
      pendingProposal,
      history,
    };
  });

// =========================================================
// Propose change
// =========================================================
export const proposeHangoutChange = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        actor: actorSchema,
        changes: changesSchema,
        comment: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let viewer;
    try {
      viewer = await resolveActor(data.actor);
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }

    // Hangout state check
    const { data: hangout } = await supabaseAdmin
      .from("requests")
      .select(
        "id, title, pitch, start_time, end_time, hangout_status, visibility, hangout_kind, category, venue_id, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location)",
      )
      .eq("id", viewer.hangout_id)
      .maybeSingle();
    if (!hangout) return { ok: false as const, error: "hangout_not_found" as const };
    if (hangout.hangout_status === "cancelled" || hangout.hangout_status === "completed") {
      return { ok: false as const, error: "hangout_terminal" as const };
    }
    // Any active participant may propose changes in any hangout kind.



    // Existing pending check
    const { data: existing } = await supabaseAdmin
      .from("hangout_change_requests")
      .select("id")
      .eq("hangout_id", viewer.hangout_id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: false as const, error: "pending_exists" as const };

    // Normalize venue change so old & new snapshots are coherent.
    const incoming: any = { ...data.changes };
    if (incoming.start_time) incoming.start_time = new Date(incoming.start_time).toISOString();
    if (incoming.end_time) incoming.end_time = new Date(incoming.end_time).toISOString();
    const newSnapshot: Record<string, any> = {};
    const oldSnapshot: Record<string, any> = {};
    let proposedVenueRow: { name: string; location: string | null } | null = null;

    const venueKeysProvided =
      "venue_id" in incoming || "custom_venue_name" in incoming || "custom_venue_location" in incoming || "custom_venue_image_url" in incoming;
    if (venueKeysProvided) {
      // Treat the four venue fields as one atomic group: include all four in snapshots.
      if (incoming.venue_id) {
        newSnapshot.venue_id = incoming.venue_id;
        newSnapshot.custom_venue_name = null;
        newSnapshot.custom_venue_location = null;
        newSnapshot.custom_venue_image_url = null;
        const { data: v } = await supabaseAdmin
          .from("venues")
          .select("name, location")
          .eq("id", incoming.venue_id)
          .maybeSingle();
        proposedVenueRow = v ?? null;
      } else {
        newSnapshot.venue_id = null;
        newSnapshot.custom_venue_name = incoming.custom_venue_name ?? null;
        newSnapshot.custom_venue_location = incoming.custom_venue_location ?? null;
        newSnapshot.custom_venue_image_url = incoming.custom_venue_image_url ?? null;
      }
      oldSnapshot.venue_id = hangout.venue_id;
      oldSnapshot.custom_venue_name = hangout.custom_venue_name;
      oldSnapshot.custom_venue_location = hangout.custom_venue_location;
      oldSnapshot.custom_venue_image_url = hangout.custom_venue_image_url;
    }
    for (const k of ["start_time", "end_time", "title", "pitch", "category"] as const) {
      if (k in incoming) {
        newSnapshot[k] = incoming[k];
        oldSnapshot[k] = (hangout as any)[k];
      }
    }

    // No-op guard
    const actuallyChanged = Object.keys(newSnapshot).some((k) => newSnapshot[k] !== oldSnapshot[k]);
    if (!actuallyChanged) return { ok: false as const, error: "no_changes" as const };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("hangout_change_requests")
      .insert({
        hangout_id: viewer.hangout_id,
        proposed_by_participant_id: viewer.id,
        old_snapshot: oldSnapshot,
        new_snapshot: newSnapshot,
        proposer_comment: data.comment?.trim() || null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("[changes] insert", insErr);
      return { ok: false as const, error: "insert_failed" as const };
    }

    // Notify recipients who need to act on this proposal.
    // - friend_request: everyone else (the counterparty).
    // - public/private: only Ned, since only Ned can approve.
    let notifyQuery = supabaseAdmin
      .from("hangout_participants")
      .select("id, type, slug, email, display_name")
      .eq("hangout_id", viewer.hangout_id)
      .eq("is_active", true)
      .neq("id", viewer.id);
    if (hangout.hangout_kind !== "friend_request") {
      notifyQuery = notifyQuery.eq("type", "ned");
    }
    const { data: others } = await notifyQuery;

    const diffs = snapshotDiffs(oldSnapshot, newSnapshot, {
      current: (hangout as any).venue ?? null,
      proposed: proposedVenueRow,
    });
    const proposerName = viewer.display_name ?? (viewer.type === "ned" ? "Ned" : "Someone");
    const hangoutTitle = hangout.title ?? hangout.pitch ?? "Your hangout";
    await Promise.allSettled(
      (others ?? []).map((p: any) => {
        if (!p.email) return Promise.resolve();
        return sendChangeProposedEmail({
          to: p.email,
          recipientName: p.display_name ?? "there",
          proposerName,
          hangoutTitle,
          diffs: diffs.map(({ label, current, proposed }) => ({ label, current, proposed })),
          comment: data.comment ?? null,
          actionUrl: participantUrl(p),
        });
      }),
    );

    return { ok: true as const, proposalId: inserted.id };
  });

// =========================================================
// Respond to change
// =========================================================
export const respondToHangoutChange = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        actor: actorSchema,
        proposalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        comment: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let viewer;
    try {
      viewer = await resolveActor(data.actor);
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }

    const { data: proposal } = await supabaseAdmin
      .from("hangout_change_requests")
      .select("*, proposer:hangout_participants!hangout_change_requests_proposed_by_participant_id_fkey(id, type, slug, email, display_name)")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!proposal) return { ok: false as const, error: "not_found" as const };
    if (proposal.hangout_id !== viewer.hangout_id) return { ok: false as const, error: "unauthorized" as const };
    if (proposal.status !== "pending") return { ok: false as const, error: "not_pending" as const };

    // Approval permissions depend on hangout_kind:
    // - friend_request: counterparty (anyone who isn't the proposer)
    // - public / private: only Ned is the final approver
    const { data: hangoutRow } = await supabaseAdmin
      .from("requests")
      .select("hangout_kind")
      .eq("id", proposal.hangout_id)
      .maybeSingle();
    const hangoutKind = hangoutRow?.hangout_kind ?? "friend_request";
    if (hangoutKind === "friend_request") {
      if (proposal.proposed_by_participant_id === viewer.id) {
        return { ok: false as const, error: "cannot_self_respond" as const };
      }
    } else {
      if (viewer.type !== "ned") {
        return { ok: false as const, error: "ned_only_approver" as const };
      }
    }

    const trimmedComment = data.comment?.trim() || null;

    if (data.decision === "rejected") {
      const { error } = await supabaseAdmin
        .from("hangout_change_requests")
        .update({
          status: "rejected",
          responder_participant_id: viewer.id,
          responder_comment: trimmedComment,
          responded_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      if (error) return { ok: false as const, error: "update_failed" as const };
    } else {
      // Apply new_snapshot atomically to requests
      const newSnap = proposal.new_snapshot as Record<string, any>;
      const updatePayload: Record<string, any> = {};
      for (const k of MUTABLE_KEYS) {
        if (k in newSnap) updatePayload[k] = newSnap[k];
      }
      updatePayload.updated_at = new Date().toISOString();

      const { error: upErr } = await (supabaseAdmin as any)
        .from("requests")
        .update(updatePayload)
        .eq("id", proposal.hangout_id);
      if (upErr) {
        console.error("[changes] apply", upErr);
        return { ok: false as const, error: "apply_failed" as const };
      }

      // Time change → reconfirmation flag + emails
      const timeChanged = TIME_KEYS.some((k) => k in newSnap);
      let reconfirmTargets: any[] = [];
      if (timeChanged) {
        const { data: targets } = await supabaseAdmin
          .from("hangout_participants")
          .select("id, slug, email, display_name, type")
          .eq("hangout_id", proposal.hangout_id)
          .eq("is_active", true)
          .in("type", ["invitee", "attendee"]);
        reconfirmTargets = targets ?? [];
        if (reconfirmTargets.length) {
          await supabaseAdmin
            .from("hangout_participants")
            .update({ needs_reconfirmation: true })
            .in(
              "id",
              reconfirmTargets.map((t: any) => t.id),
            );
        }
      }

      const { error: rErr } = await supabaseAdmin
        .from("hangout_change_requests")
        .update({
          status: "approved",
          responder_participant_id: viewer.id,
          responder_comment: trimmedComment,
          responded_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      if (rErr) return { ok: false as const, error: "update_failed" as const };

      // Send reconfirm emails
      if (timeChanged && reconfirmTargets.length) {
        const { data: hg } = await supabaseAdmin
          .from("requests")
          .select("title, pitch")
          .eq("id", proposal.hangout_id)
          .maybeSingle();
        const hangoutTitle = hg?.title ?? hg?.pitch ?? "Your hangout";
        const oldWhen = fmtWhen(
          (proposal.old_snapshot as any).start_time,
          (proposal.old_snapshot as any).end_time,
        );
        const newWhen = fmtWhen(
          newSnap.start_time ?? (proposal.old_snapshot as any).start_time,
          newSnap.end_time ?? (proposal.old_snapshot as any).end_time,
        );
        await Promise.allSettled(
          reconfirmTargets.map((p: any) => {
            if (!p.email) return Promise.resolve();
            return sendReconfirmAttendanceEmail({
              to: p.email,
              recipientName: p.display_name ?? "there",
              hangoutTitle,
              oldWhen,
              newWhen,
              actionUrl: participantUrl(p),
            });
          }),
        );
      }
    }

    // Notify proposer
    const proposer = (proposal as any).proposer;
    if (proposer?.email) {
      const { data: hg } = await supabaseAdmin
        .from("requests")
        .select("title, pitch")
        .eq("id", proposal.hangout_id)
        .maybeSingle();
      await sendChangeDecisionEmail({
        to: proposer.email,
        proposerName: proposer.display_name ?? "there",
        responderName: viewer.display_name ?? (viewer.type === "ned" ? "Ned" : "They"),
        hangoutTitle: hg?.title ?? hg?.pitch ?? "Your hangout",
        decision: data.decision,
        comment: trimmedComment,
        actionUrl: participantUrl(proposer),
      });
    }

    return { ok: true as const };
  });

// =========================================================
// Reconfirm attendance (invitee/attendee replies after time change)
// =========================================================
export const reconfirmAttendance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        actor: actorSchema,
        response: z.enum(["accepted", "declined", "maybe"]),
        comment: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let viewer;
    try {
      viewer = await resolveActor(data.actor);
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    if (viewer.type !== "invitee" && viewer.type !== "attendee") {
      return { ok: false as const, error: "not_attendee" as const };
    }

    // Clear reconfirmation flag
    await supabaseAdmin
      .from("hangout_participants")
      .update({ needs_reconfirmation: false })
      .eq("id", viewer.id);

    // Update underlying invitee row if applicable
    if (viewer.type === "invitee" && viewer.source_row_id) {
      await supabaseAdmin
        .from("hangout_invitees")
        .update({
          response_status: data.response,
          comment: data.comment?.trim() || null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", viewer.source_row_id);
    }
    // Attendee row: nothing to update on requests; the participant row is the source of truth.

    return { ok: true as const };
  });
