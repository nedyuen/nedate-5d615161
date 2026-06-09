import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getParticipantContext,
  proposeHangoutChange,
  respondToHangoutChange,
  reconfirmAttendance,
} from "@/lib/hangout-changes.functions";
import { fmtRange, venueDisplay } from "@/lib/nedate";
import { Check, Clock, Loader2, MapPin, Pencil, X, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Actor =
  | { kind: "slug"; slug: string }
  | { kind: "admin"; adminPassword: string; hangoutId: string };

type Ctx = Awaited<ReturnType<typeof getParticipantContext>>;

export function HangoutAgreementPanel({ actor }: { actor: Actor }) {
  const fetchCtx = useServerFn(getParticipantContext);
  const [ctx, setCtx] = useState<Extract<Ctx, { ok: true }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetchCtx({ data: { actor } });
    if (r.ok) setCtx(r);
    setLoading(false);
  }, [fetchCtx, actor]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
        Loading agreement…
      </div>
    );
  }
  if (!ctx) return null;

  const { hangout, viewer, pendingProposal, history, participants } = ctx;
  const isProposer = pendingProposal && pendingProposal.proposed_by_participant_id === viewer.id;
  const kind = (hangout as any).hangout_kind ?? "friend_request";
  const isFriendRequest = kind === "friend_request";
  const nedApprovesOnly = !isFriendRequest;
  const canRespond = !!pendingProposal && (
    nedApprovesOnly ? viewer.type === "ned" : !isProposer
  );
  const v = venueDisplay(hangout as any);
  const terminal = hangout.hangout_status === "cancelled" || hangout.hangout_status === "completed";
  const canPropose = !terminal && !pendingProposal;

  const subtitle = isFriendRequest
    ? "changes require the other side to accept"
    : "any participant can propose · Ned approves";

  return (
    <div className="mt-8 rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-primary">The agreement</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {participants.length} participant{participants.length === 1 ? "" : "s"} · {subtitle}
          </p>
        </div>
        {canPropose && (
          <button
            onClick={() => setProposing(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="size-3.5" /> Propose changes
          </button>
        )}
      </div>


      {/* Reconfirmation banner */}
      {viewer.needs_reconfirmation && (viewer.type === "invitee" || viewer.type === "attendee") && (
        <ReconfirmBanner actor={actor} onDone={reload} />
      )}

      {/* Pending proposal */}
      {pendingProposal && (
        <PendingProposal
          proposal={pendingProposal}
          canRespond={!!canRespond}
          isProposer={!!isProposer}
          nedApprovesOnly={nedApprovesOnly}
          viewerIsNed={viewer.type === "ned"}
          actor={actor}
          onResolved={reload}
        />
      )}

      {/* Current snapshot */}
      <div className="border-t border-border/60 px-6 py-5 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Clock className="size-4 mt-0.5 text-primary" />
          <span>{fmtRange(hangout.start_time, hangout.end_time)}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="size-4 mt-0.5 text-primary" />
          <span>{v.name}{v.location ? ` · ${v.location}` : ""}</span>
        </div>
        {hangout.title && <div className="text-muted-foreground"><span className="text-foreground">{hangout.title}</span></div>}
        {hangout.pitch && <div className="italic text-muted-foreground">"{hangout.pitch}"</div>}
      </div>

      {/* History */}
      {history.length > 0 && (
        <details className="border-t border-border/60 px-6 py-4">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <History className="size-3.5" /> Change history ({history.length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs">
            {history.map((h: any) => (
              <li key={h.id} className="rounded-xl bg-background border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-primary">
                    {h.proposer?.display_name ?? "Someone"} proposed
                  </span>
                  <span className={h.status === "approved" ? "text-emerald-700" : "text-red-700"}>
                    {h.status === "approved" ? "✓ accepted" : "✕ rejected"}
                  </span>
                </div>
                <DiffList oldSnap={h.old_snapshot} newSnap={h.new_snapshot} />
                {h.proposer_comment && <div className="mt-1 italic text-muted-foreground">"{h.proposer_comment}"</div>}
                {h.responder_comment && (
                  <div className="mt-1 italic text-muted-foreground">
                    Reply from {h.responder?.display_name ?? "them"}: "{h.responder_comment}"
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {proposing && (
        <ProposeDialog
          actor={actor}
          current={hangout}
          onClose={() => setProposing(false)}
          onSubmitted={() => { setProposing(false); reload(); }}
        />
      )}
    </div>
  );
}

function DiffList({ oldSnap, newSnap }: { oldSnap: any; newSnap: any }) {
  const rows: { label: string; from: string; to: string }[] = [];
  if ("start_time" in newSnap || "end_time" in newSnap) {
    rows.push({
      label: "When",
      from: fmtRange(oldSnap.start_time ?? "", oldSnap.end_time),
      to: fmtRange(newSnap.start_time ?? oldSnap.start_time ?? "", newSnap.end_time ?? oldSnap.end_time),
    });
  }
  if ("custom_venue_name" in newSnap || "venue_id" in newSnap) {
    rows.push({
      label: "Where",
      from: oldSnap.custom_venue_name ?? (oldSnap.venue_id ? "existing venue" : "TBD"),
      to: newSnap.custom_venue_name ?? (newSnap.venue_id ? "existing venue" : "TBD"),
    });
  }
  for (const k of ["title", "pitch", "category"]) {
    if (k in newSnap) rows.push({ label: k, from: String(oldSnap[k] ?? "—"), to: String(newSnap[k] ?? "—") });
  }
  return (
    <ul className="mt-1.5 space-y-0.5">
      {rows.map((r) => (
        <li key={r.label} className="text-muted-foreground">
          <span className="capitalize">{r.label}: </span>
          <span className="line-through opacity-60">{r.from}</span> → <span className="text-foreground">{r.to}</span>
        </li>
      ))}
    </ul>
  );
}

function PendingProposal({
  proposal,
  canRespond,
  isProposer,
  nedApprovesOnly,
  viewerIsNed,
  actor,
  onResolved,
}: {
  proposal: any;
  canRespond: boolean;
  isProposer: boolean;
  nedApprovesOnly: boolean;
  viewerIsNed: boolean;
  actor: Actor;
  onResolved: () => void;
}) {
  const respond = useServerFn(respondToHangoutChange);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    const r = await respond({ data: { actor, proposalId: proposal.id, decision, comment: comment.trim() || null } });
    setBusy(null);
    if (!(r as any).ok) { toast.error("Couldn't save response"); return; }
    toast.success(decision === "approved" ? "Approved — changes applied" : "Proposal rejected");
    onResolved();
  }

  const waitingMessage = isProposer
    ? nedApprovesOnly
      ? "Waiting for Ned to approve or reject."
      : "Waiting for the other side to respond."
    : nedApprovesOnly && !viewerIsNed
      ? "Only Ned can approve or reject this proposal. You'll get a reconfirmation if the time changes."
      : "Waiting on response.";

  return (
    <div className="mx-6 my-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-medium">
        <AlertTriangle className="size-3.5" /> Pending change proposal from {proposal.proposer?.display_name ?? "someone"}
      </div>
      <DiffList oldSnap={proposal.old_snapshot} newSnap={proposal.new_snapshot} />
      {proposal.proposer_comment && (
        <div className="mt-2 text-sm italic text-muted-foreground">"{proposal.proposer_comment}"</div>
      )}
      {canRespond ? (
        <>
          <div className="mt-3 text-xs font-medium text-primary">Approve or reject this change proposal</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional reply"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
          <div className="mt-2 flex gap-2 justify-end">
            <button
              disabled={!!busy}
              onClick={() => decide("rejected")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs hover:bg-muted disabled:opacity-50"
            >
              {busy === "rejected" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Reject proposal
            </button>
            <button
              disabled={!!busy}
              onClick={() => decide("approved")}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "approved" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve proposal
            </button>
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">{waitingMessage}</div>
      )}
    </div>
  );
}

function ReconfirmBanner({ actor, onDone }: { actor: Actor; onDone: () => void }) {
  const reconfirm = useServerFn(reconfirmAttendance);
  const [busy, setBusy] = useState<string | null>(null);
  async function reply(response: "accepted" | "declined" | "maybe") {
    setBusy(response);
    const r = await reconfirm({ data: { actor, response, comment: null } });
    setBusy(null);
    if (!(r as any).ok) { toast.error("Couldn't save"); return; }
    toast.success("Thanks — updated");
    onDone();
  }
  return (
    <div className="mx-6 my-4 rounded-2xl border border-amber-500/40 bg-amber-50/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-medium text-amber-900">
        <AlertTriangle className="size-3.5" /> Confirm attendance after schedule change
      </div>
      <p className="mt-1 text-sm text-amber-900/80">
        The time changed and has been approved. Are you still able to attend? This updates your attendance only — it doesn't change the hangout.
      </p>
      <div className="mt-2 flex gap-2">
        <button disabled={!!busy} onClick={() => reply("accepted")} className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy === "accepted" ? "…" : "Attending"}
        </button>
        <button disabled={!!busy} onClick={() => reply("maybe")} className="rounded-full border border-border bg-card px-4 py-2 text-xs hover:bg-muted disabled:opacity-50">Maybe</button>
        <button disabled={!!busy} onClick={() => reply("declined")} className="rounded-full border border-border bg-card px-4 py-2 text-xs hover:bg-muted disabled:opacity-50">Not attending</button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ProposeDialog({
  actor,
  current,
  onClose,
  onSubmitted,
}: {
  actor: Actor;
  current: any;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const propose = useServerFn(proposeHangoutChange);
  const [start, setStart] = useState(toLocalInput(current.start_time));
  const [end, setEnd] = useState(toLocalInput(current.end_time));
  const [title, setTitle] = useState(current.title ?? "");
  const [pitch, setPitch] = useState(current.pitch ?? "");
  const [venueName, setVenueName] = useState(current.custom_venue_name ?? current.venue?.name ?? "");
  const [venueLoc, setVenueLoc] = useState(current.custom_venue_location ?? current.venue?.location ?? "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const origStart = toLocalInput(current.start_time);
  const origEnd = toLocalInput(current.end_time);
  const origVenueName = current.custom_venue_name ?? current.venue?.name ?? "";
  const origVenueLoc = current.custom_venue_location ?? current.venue?.location ?? "";

  async function submit() {
    const changes: any = {};
    if (start !== origStart) changes.start_time = new Date(start).toISOString();
    if (end !== origEnd) changes.end_time = end ? new Date(end).toISOString() : null;
    if (title !== (current.title ?? "")) changes.title = title;
    if (pitch !== (current.pitch ?? "")) changes.pitch = pitch || null;
    if (venueName !== origVenueName || venueLoc !== origVenueLoc) {
      changes.venue_id = null;
      changes.custom_venue_name = venueName || null;
      changes.custom_venue_location = venueLoc || null;
    }
    if (Object.keys(changes).length === 0) { toast.error("Nothing changed"); return; }
    setBusy(true);
    const r = await propose({ data: { actor, changes, comment: comment.trim() || null } });
    setBusy(false);
    if (!(r as any).ok) {
      const err = (r as any).error;
      toast.error(
        err === "pending_exists" ? "Another proposal is already pending" :
        err === "no_changes" ? "Nothing changed" :
        err === "hangout_terminal" ? "Hangout is closed" :
        "Couldn't submit proposal",
      );
      return;
    }
    toast.success("Proposal sent");
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-card border border-border/60 p-6 shadow-warm max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-primary">Propose changes</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{current.hangout_kind === "friend_request" ? "The other side must accept before changes apply." : "Ned reviews and approves all change proposals. If the time changes, attendees will be asked to reconfirm attendance."}</p>

        <div className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Start</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">End (optional)</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Venue name</span>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Venue location</span>
            <input value={venueLoc} onChange={(e) => setVenueLoc(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Pitch</span>
            <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={3} className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary resize-none" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-primary">Note (optional)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Why this change?" className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:border-primary resize-none" />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button disabled={busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Send proposal
          </button>
        </div>
      </div>
    </div>
  );
}
