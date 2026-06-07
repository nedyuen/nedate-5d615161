import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendRequestConfirmation,
  sendInvitation,
  sendInviteeResponseToNed,
} from "./email.functions";

// --- helpers ---
const SLUG_RE = /^[a-z0-9]{8,32}$/i;

function fmtRangeServer(start: string) {
  const s = new Date(start);
  return `${s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function venueDisplayServer(h: {
  venue: { name: string; location: string | null; image_url: string | null } | null;
  custom_venue_name: string | null;
  custom_venue_location: string | null;
  custom_venue_image_url: string | null;
}) {
  if (h.venue) return { name: h.venue.name, location: h.venue.location, imageUrl: h.venue.image_url };
  return {
    name: h.custom_venue_name ?? "TBD",
    location: h.custom_venue_location,
    imageUrl: h.custom_venue_image_url,
  };
}

const venueInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), venue_id: z.string().uuid() }),
  z.object({
    kind: z.literal("custom"),
    name: z.string().min(1).max(200),
    location: z.string().max(300).optional().nullable(),
    image_url: z.string().url().max(2000).optional().nullable(),
  }),
]);

// --- listing for homepage ---
export const listUpcomingPublicHangouts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("requests")
    .select(
      "id, slug, category, title, pitch, start_time, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location, image_url)",
    )
    .eq("hangout_kind", "public_hangout")
    .eq("hangout_status", "active")
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true });
  if (error) {
    console.error("[hangouts] list failed", error);
    return { hangouts: [] };
  }
  return { hangouts: data ?? [] };
});

// --- public join request flow ---
export const getPublicHangoutBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(SLUG_RE) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("requests")
      .select(
        "id, slug, category, title, pitch, start_time, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location, image_url)",
      )
      .eq("slug", data.slug)
      .eq("hangout_kind", "public_hangout")
      .eq("hangout_status", "active")
      .maybeSingle();
    if (error) {
      console.error("[hangouts] getPublicHangoutBySlug", error);
      return { hangout: null };
    }
    return { hangout: row };
  });

export const submitJoinRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().regex(SLUG_RE),
        name: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(255),
        message: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parent, error: pErr } = await supabaseAdmin
      .from("requests")
      .select(
        "id, slug, category, title, pitch, start_time, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location, image_url)",
      )
      .eq("slug", data.slug)
      .eq("hangout_kind", "public_hangout")
      .eq("hangout_status", "active")
      .maybeSingle();
    if (pErr || !parent) return { ok: false, error: "hangout_not_found" as const };

    // join_request rows mirror parent's category/venue so DB constraints pass,
    // but display always reads through parent_hangout_id at view time.
    const insertPayload = {
      hangout_kind: "join_request",
      initiator: "friend",
      visibility: "private",
      hangout_status: "active",
      request_status: "pending",
      parent_hangout_id: parent.id,
      category: parent.category,
      pitch: parent.pitch ?? parent.title ?? "Joining your hangout",
      start_time: parent.start_time,
      requester_name: data.name,
      requester_email: data.email,
      request_message: data.message ?? null,
      venue_id: parent.venue ? undefined : null,
      custom_venue_name: parent.venue ? null : (parent.custom_venue_name ?? "TBD"),
    } as any;
    // Set venue_id properly via a follow-up select if needed
    if (parent.venue) {
      // We don't have parent's venue_id from the select above; fetch it.
      const { data: v } = await supabaseAdmin
        .from("requests")
        .select("venue_id")
        .eq("id", parent.id)
        .single();
      insertPayload.venue_id = v?.venue_id ?? null;
      if (!insertPayload.venue_id) {
        insertPayload.custom_venue_name = parent.custom_venue_name ?? "TBD";
      }
    }

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("requests")
      .insert(insertPayload)
      .select("slug")
      .single();
    if (iErr || !inserted) {
      console.error("[hangouts] submitJoinRequest insert", iErr);
      return { ok: false, error: "insert_failed" as const };
    }

    const v = venueDisplayServer(parent as any);
    const venueText = v.name + (v.location ? ` · ${v.location}` : "");
    try {
      await sendRequestConfirmation({
        data: {
          to: data.email,
          name: data.name,
          pitch: data.message?.trim() || `Joining: ${parent.title ?? parent.pitch ?? "Ned's hangout"}`,
          venue: venueText,
          when: fmtRangeServer(parent.start_time),
          trackingUrl: `${getOrigin()}/r/${inserted.slug}`,
        },
      });
    } catch (e) {
      console.error("[hangouts] confirmation email", e);
    }
    return { ok: true as const, slug: inserted.slug };
  });

// --- invitee flow ---
export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(SLUG_RE) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("hangout_invitees")
      .select("id, name, email, response_status, comment, responded_at, hangout_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error || !invite) return { invite: null, hangout: null };

    const { data: hangout } = await supabaseAdmin
      .from("requests")
      .select(
        "id, slug, category, title, pitch, start_time, hangout_status, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location, image_url)",
      )
      .eq("id", invite.hangout_id)
      .maybeSingle();

    return { invite, hangout };
  });

export const respondToInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().regex(SLUG_RE),
        response: z.enum(["accepted", "declined", "maybe"]),
        comment: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("hangout_invitees")
      .update({
        response_status: data.response,
        comment: data.comment?.trim() || null,
        responded_at: new Date().toISOString(),
      })
      .eq("slug", data.slug)
      .select("id, name, email, hangout_id")
      .maybeSingle();
    if (error || !invite) return { ok: false as const, error: "not_found" as const };

    const { data: hangout } = await supabaseAdmin
      .from("requests")
      .select("title, pitch")
      .eq("id", invite.hangout_id)
      .maybeSingle();

    try {
      await sendInviteeResponseToNed({
        data: {
          inviteeName: invite.name,
          inviteeEmail: invite.email,
          response: data.response,
          comment: data.comment ?? null,
          hangoutTitle: hangout?.title ?? hangout?.pitch ?? "Hangout",
        },
      });
    } catch (e) {
      console.error("[hangouts] notify ned", e);
    }
    return { ok: true as const };
  });

// --- admin create hangout ---
export const createHangout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        visibility: z.enum(["public", "private"]),
        category: z.string().min(1).max(100),
        title: z.string().trim().min(1).max(300),
        pitch: z.string().trim().max(2000).optional().nullable(),
        start_time: z.string().min(1),
        venue: venueInput,
        invitees: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(200),
              email: z.string().trim().email().max(255),
            }),
          )
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.visibility === "private" && data.invitees.length === 0) {
      return { ok: false as const, error: "private_needs_invitees" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const kind = data.visibility === "public" ? "public_hangout" : "private_hangout";

    const venueFields =
      data.venue.kind === "existing"
        ? { venue_id: data.venue.venue_id, custom_venue_name: null, custom_venue_location: null, custom_venue_image_url: null }
        : {
            venue_id: null,
            custom_venue_name: data.venue.name,
            custom_venue_location: data.venue.location ?? null,
            custom_venue_image_url: data.venue.image_url ?? null,
          };

    const { data: hangout, error } = await supabaseAdmin
      .from("requests")
      .insert({
        hangout_kind: kind,
        initiator: "ned",
        visibility: data.visibility,
        hangout_status: "active",
        request_status: null,
        category: data.category,
        title: data.title,
        pitch: data.pitch ?? null,
        start_time: new Date(data.start_time).toISOString(),
        requester_name: null,
        requester_email: null,
        ...venueFields,
      })
      .select(
        "id, slug, title, pitch, start_time, custom_venue_name, custom_venue_location, custom_venue_image_url, venue:venues(name, location, image_url)",
      )
      .single();
    if (error || !hangout) {
      console.error("[hangouts] createHangout", error);
      return { ok: false as const, error: "insert_failed" as const };
    }

    let invitedCount = 0;
    if (data.invitees.length) {
      const { data: invitees, error: invErr } = await supabaseAdmin
        .from("hangout_invitees")
        .insert(
          data.invitees.map((i) => ({
            hangout_id: hangout.id,
            name: i.name,
            email: i.email,
          })),
        )
        .select("id, name, email, slug");
      if (invErr) {
        console.error("[hangouts] invitee insert", invErr);
      } else if (invitees) {
        invitedCount = invitees.length;
        const v = venueDisplayServer(hangout as any);
        const venueText = v.name + (v.location ? ` · ${v.location}` : "");
        await Promise.allSettled(
          invitees.map((inv) =>
            sendInvitation({
              data: {
                to: inv.email,
                name: inv.name,
                hangoutTitle: hangout.title ?? "A hangout with Ned",
                pitch: hangout.pitch ?? null,
                venue: venueText,
                when: fmtRangeServer(hangout.start_time),
                inviteUrl: `${getOrigin()}/i/${inv.slug}`,
              },
            }),
          ),
        );
      }
    }

    return { ok: true as const, hangoutId: hangout.id, slug: hangout.slug, invitedCount };
  });

// --- admin: list hangouts grouped ---
export const listHangoutsForAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hangouts } = await supabaseAdmin
    .from("requests")
    .select(
      "*, venue:venues(name, location, image_url)",
    )
    .order("created_at", { ascending: false });

  const nedHangoutIds = (hangouts ?? [])
    .filter((h: any) => h.initiator === "ned")
    .map((h: any) => h.id);

  let invitees: any[] = [];
  if (nedHangoutIds.length) {
    const { data: inv } = await supabaseAdmin
      .from("hangout_invitees")
      .select("*")
      .in("hangout_id", nedHangoutIds);
    invitees = inv ?? [];
  }
  return { hangouts: hangouts ?? [], invitees };
});

// --- helper ---
function getOrigin() {
  return process.env.SITE_URL ?? "https://nedate.lovable.app";
}
