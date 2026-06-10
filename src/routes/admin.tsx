import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ADMIN_PASSWORD, ADMIN_STORAGE_KEY, CATEGORIES, categoryMeta, fmtRange, londonLocalToIso, venueDisplay } from "@/lib/nedate";
import { Check, Loader2, LogOut, Plus, Trash2, X, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createHangout,
  listHangoutsForAdmin,
  adminUpdateRequestStatus,
  adminListVenues,
  adminAddVenue,
  adminDeleteVenue,
} from "@/lib/hangouts.functions";
import { HangoutAgreementPanel } from "@/components/HangoutAgreementPanel";


export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Nedate" }] }),
  component: AdminPage,
});

type Hangout = {
  id: string; slug: string; category: string;
  hangout_kind: string; initiator: string; visibility: string;
  hangout_status: string; request_status: string | null;
  title: string | null; pitch: string | null;
  requester_name: string | null; requester_email: string | null;
  request_message: string | null;
  start_time: string; end_time: string | null;
  admin_comment: string | null;
  parent_hangout_id: string | null;
  custom_venue_name: string | null; custom_venue_location: string | null; custom_venue_image_url: string | null;
  created_at: string;
  venue: { name: string; location: string | null; image_url: string | null } | null;
};
type Invitee = { id: string; hangout_id: string; name: string; email: string; slug: string; response_status: string; comment: string | null; responded_at: string | null };
type Venue = { id: string; category: string; name: string; description: string | null; location: string | null; image_url: string | null };

function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(ADMIN_STORAGE_KEY) === "1") setAuth(true);
  }, []);

  if (!auth) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === ADMIN_PASSWORD) { sessionStorage.setItem(ADMIN_STORAGE_KEY, "1"); setAuth(true); }
            else toast.error("Nope");
          }}
          className="w-full max-w-sm rounded-3xl bg-card border border-border/60 p-8 shadow-soft"
        >
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <h1 className="mt-4 font-display text-2xl text-primary">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the password.</p>
          <input
            type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus
            className="mt-5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-primary outline-none"
          />
          <button className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Unlock</button>
        </form>
      </div>
    );
  }

  return <AdminInner onLogout={() => { sessionStorage.removeItem(ADMIN_STORAGE_KEY); setAuth(false); }} />;
}

function AdminInner({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"hangouts" | "venues">("hangouts");
  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <button onClick={onLogout} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><LogOut className="size-4" /> Log out</button>
        </div>
        <div className="mx-auto max-w-6xl mt-8 flex items-center gap-2 border-b border-border/60">
          {(["hangouts", "venues"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>
              {t === "hangouts" ? "Hangouts" : "Venues & ideas"}
            </button>
          ))}
        </div>
      </header>
      <main className="px-5 py-8 sm:px-10">
        <div className="mx-auto max-w-6xl">
          {tab === "hangouts" ? <HangoutsTab /> : <VenuesTab />}
        </div>
      </main>
    </div>
  );
}

function HangoutsTab() {
  const list = useServerFn(listHangoutsForAdmin);
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Hangout | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const r = await list();
    setHangouts((r.hangouts as any) ?? []);
    setInvitees((r.invitees as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const friendRequests = useMemo(() => hangouts.filter(h => h.hangout_kind === "friend_request"), [hangouts]);
  const joinRequests = useMemo(() => hangouts.filter(h => h.hangout_kind === "join_request"), [hangouts]);
  const nedHangouts = useMemo(() => hangouts.filter(h => h.initiator === "ned"), [hangouts]);
  const hangoutById = useMemo(() => Object.fromEntries(hangouts.map(h => [h.id, h])), [hangouts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-3xl text-primary">Hangouts</h2>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" /> Create hangout
        </button>
      </div>

      {loading && <div className="text-muted-foreground">Loading…</div>}

      <Section title="Friend requests" count={friendRequests.filter(r => r.request_status === "pending").length}>
        <RequestGrid items={friendRequests} onOpen={setActive} />
      </Section>

      <Section title="Public join requests" count={joinRequests.filter(r => r.request_status === "pending").length}>
        <RequestGrid items={joinRequests} onOpen={setActive} parentLookup={hangoutById} />
      </Section>

      <Section title="My hangouts" count={nedHangouts.length}>
        {nedHangouts.length === 0 ? (
          <Empty>You haven't created any hangouts yet.</Empty>
        ) : (
          <div className="space-y-3">
            {nedHangouts.map(h => (
              <NedHangoutRow key={h.id} h={h} invitees={invitees.filter(i => i.hangout_id === h.id)} joinRequests={joinRequests.filter(j => j.parent_hangout_id === h.id)} onOpenRequest={setActive} />
            ))}
          </div>
        )}
      </Section>

      {active && <RequestModal req={active} onClose={() => setActive(null)} onUpdated={() => { load(); setActive(null); }} />}
      {showCreate && <CreateHangoutModal onClose={() => setShowCreate(false)} onCreated={() => { load(); setShowCreate(false); }} />}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h3 className="font-display text-2xl text-primary mb-4">{title} {typeof count === "number" && <span className="text-muted-foreground text-base">({count})</span>}</h3>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6">{children}</div>;
}

function RequestGrid({ items, onOpen, parentLookup }: { items: Hangout[]; onOpen: (h: Hangout) => void; parentLookup?: Record<string, Hangout> }) {
  if (items.length === 0) return <Empty>Nothing here.</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((r) => {
        const parent = r.parent_hangout_id ? parentLookup?.[r.parent_hangout_id] : null;
        return (
          <button key={r.id} onClick={() => onOpen(r)} className="text-left rounded-2xl bg-card border border-border/60 p-5 shadow-soft hover:border-primary/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{categoryMeta(r.category).emoji} {categoryMeta(r.category).label}</span>
              <StatusPill status={r.request_status ?? "pending"} />
            </div>
            <div className="mt-2 font-display text-lg text-primary">{r.requester_name}</div>
            {parent && <div className="text-xs text-muted-foreground">↳ joining: {parent.title ?? "your hangout"}</div>}
            <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">"{r.request_message ?? r.pitch}"</div>
            <div className="mt-3 text-xs text-muted-foreground">{fmtRange(r.start_time, r.end_time)}</div>
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "approved" ? "bg-emerald-100 text-emerald-800" : status === "rejected" ? "bg-red-100 text-red-800" : "bg-accent/30 text-primary";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>{status}</span>;
}

function NedHangoutRow({ h, invitees, joinRequests, onOpenRequest }: { h: Hangout; invitees: Invitee[]; joinRequests: Hangout[]; onOpenRequest: (h: Hangout) => void }) {
  const [open, setOpen] = useState(false);
  const v = venueDisplay(h);
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{categoryMeta(h.category).emoji} {categoryMeta(h.category).label}</span>
            <span className={`text-[10px] rounded-full px-2 py-0.5 uppercase tracking-wide ${h.visibility === "public" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{h.visibility}</span>
          </div>
          <div className="mt-0.5 font-display text-lg text-primary truncate">{h.title}</div>
          <div className="text-xs text-muted-foreground">{fmtRange(h.start_time)} · {v.name}</div>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">{invitees.length} invited{joinRequests.length ? ` · ${joinRequests.length} requests` : ""}</div>
      </button>
      {open && (
        <div className="border-t border-border/60 p-4 space-y-4">
          {h.pitch && <p className="text-sm italic text-muted-foreground">"{h.pitch}"</p>}
          {h.visibility === "public" && (
            <div className="text-xs text-muted-foreground">Public link: <Link to="/join/$slug" params={{ slug: h.slug }} className="underline">/join/{h.slug}</Link></div>
          )}
          <div>
            <div className="text-xs font-medium text-primary uppercase tracking-wide mb-2">Invitees ({invitees.length})</div>
            {invitees.length === 0 ? <Empty>No invitees.</Empty> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {invitees.map(i => (
                  <div key={i.id} className="rounded-xl border border-border/60 p-3 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-primary truncate">{i.name}</div>
                      <InviteePill status={i.response_status} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{i.email}</div>
                    {i.comment && <div className="mt-2 text-xs italic text-foreground">"{i.comment}"</div>}
                    <div className="mt-2 text-[10px] text-muted-foreground">Invite: <Link to="/i/$slug" params={{ slug: i.slug }} className="underline">/i/{i.slug}</Link></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {joinRequests.length > 0 && (
            <div>
              <div className="text-xs font-medium text-primary uppercase tracking-wide mb-2">Join requests ({joinRequests.length})</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {joinRequests.map(j => (
                  <button key={j.id} onClick={() => onOpenRequest(j)} className="text-left rounded-xl border border-border/60 p-3 bg-background hover:border-primary/40">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-primary truncate">{j.requester_name}</div>
                      <StatusPill status={j.request_status ?? "pending"} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{j.requester_email}</div>
                    {j.request_message && <div className="mt-1 text-xs italic text-muted-foreground line-clamp-2">"{j.request_message}"</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <HangoutAgreementPanel actor={{ kind: "admin", adminPassword: ADMIN_PASSWORD, hangoutId: h.id }} />
        </div>
      )}
    </div>
  );
}

function InviteePill({ status }: { status: string }) {
  const map: Record<string, string> = {
    accepted: "bg-emerald-100 text-emerald-800",
    declined: "bg-red-100 text-red-800",
    maybe: "bg-amber-100 text-amber-800",
    pending: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[status] ?? map.pending}`}>{status}</span>;
}

function RequestModal({ req, onClose, onUpdated }: { req: Hangout; onClose: () => void; onUpdated: () => void }) {
  const [comment, setComment] = useState(req.admin_comment ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const v = venueDisplay(req);
  const updateStatus = useServerFn(adminUpdateRequestStatus);

  async function decide(status: "approved" | "rejected") {
    setSaving(status);
    const trimmed = comment.trim() || null;
    const res = await updateStatus({
      data: {
        adminPassword: ADMIN_PASSWORD,
        requestId: req.id,
        status,
        comment: trimmed,
      },
    });
    if (!res.ok) { setSaving(null); toast.error("Update failed"); return; }
    setSaving(null);
    toast.success(`Marked ${status} · email sent`);
    onUpdated();
  }


  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-3xl bg-card border border-border/60 p-7 shadow-warm max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{categoryMeta(req.category).emoji} {categoryMeta(req.category).label}</div>
            <h2 className="font-display text-2xl text-primary mt-1">{req.requester_name}</h2>
            {req.requester_email && <a href={`mailto:${req.requester_email}`} className="text-sm text-muted-foreground hover:text-primary">{req.requester_email}</a>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="mt-5 rounded-2xl bg-background border border-border/60 p-4">
          <div className="text-xs text-muted-foreground mb-1">{req.hangout_kind === "join_request" ? "Message" : "Pitch"}</div>
          <p className="italic">"{req.request_message ?? req.pitch}"</p>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div><span className="text-muted-foreground">When: </span>{fmtRange(req.start_time, req.end_time)}</div>
          <div><span className="text-muted-foreground">Where: </span>{v.name}{v.location ? ` · ${v.location}` : ""}</div>
          <div><span className="text-muted-foreground">Status: </span><StatusPill status={req.request_status ?? "pending"} /></div>
          <div className="text-xs text-muted-foreground pt-1">
            Link: <Link to="/r/$slug" params={{ slug: req.slug }} className="underline">/r/{req.slug}</Link>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-primary">Note for {req.requester_name ?? "them"} (sent in email)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Looking forward to it!" />
        </label>

        <div className="mt-5 flex gap-2 justify-end">
          <button disabled={!!saving} onClick={() => decide("rejected")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm hover:bg-muted disabled:opacity-50">
            {saving === "rejected" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Decline
          </button>
          <button disabled={!!saving} onClick={() => decide("approved")} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving === "approved" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
          </button>
        </div>

        {req.hangout_kind === "friend_request" && (
          <div className="mt-6">
            <HangoutAgreementPanel actor={{ kind: "admin", adminPassword: ADMIN_PASSWORD, hangoutId: req.id }} />
          </div>
        )}
      </div>
    </div>
  );
}

function CreateHangoutModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createHangout);
  const fetchVenues = useServerFn(adminListVenues);
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [start, setStart] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customLoc, setCustomLoc] = useState("");
  const [customImg, setCustomImg] = useState("");
  const [invitees, setInvitees] = useState<{ name: string; email: string }[]>([{ name: "", email: "" }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchVenues({ data: { adminPassword: ADMIN_PASSWORD } }).then((r) => {
      setVenues(((r.venues ?? []) as Venue[]).filter((v) => v.category === category));
    });
  }, [category, fetchVenues]);


  function addInvitee() { setInvitees(v => [...v, { name: "", email: "" }]); }
  function removeInvitee(i: number) { setInvitees(v => v.filter((_, ix) => ix !== i)); }
  function updInvitee(i: number, k: "name" | "email", val: string) {
    setInvitees(v => v.map((x, ix) => ix === i ? { ...x, [k]: val } : x));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start) { toast.error("Title and date are required"); return; }
    if (useCustom ? customName.trim().length < 2 : !venueId) { toast.error("Choose or enter a venue"); return; }
    const cleanInvitees = invitees
      .map(i => ({ name: i.name.trim(), email: i.email.trim() }))
      .filter(i => i.name && /\S+@\S+\.\S+/.test(i.email));
    if (visibility === "private" && cleanInvitees.length === 0) {
      toast.error("Private hangouts need at least one invitee");
      return;
    }
    setBusy(true);
    const res = await create({
      data: {
        visibility,
        category,
        title: title.trim(),
        pitch: pitch.trim() || null,
        start_time: new Date(start).toISOString(),
        venue: useCustom
          ? { kind: "custom", name: customName.trim(), location: customLoc.trim() || null, image_url: customImg.trim() || null }
          : { kind: "existing", venue_id: venueId! },
        invitees: cleanInvitees,
      },
    });
    setBusy(false);
    if (!res.ok) { toast.error(res.error === "private_needs_invitees" ? "Private hangouts need invitees" : "Couldn't create"); return; }
    toast.success(`Created · ${res.invitedCount} invited`);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-3xl bg-card border border-border/60 p-7 shadow-warm max-h-[92vh] overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-2xl text-primary flex items-center gap-2"><Sparkles className="size-5" /> Create a hangout</h2>
            <p className="text-sm text-muted-foreground">Put something on the calendar.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(["public", "private"] as const).map((v) => (
              <button type="button" key={v} onClick={() => setVisibility(v)} className={`rounded-xl border p-3 text-left transition ${visibility === v ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"}`}>
                <div className="font-medium text-primary capitalize">{v}</div>
                <div className="text-xs text-muted-foreground">{v === "public" ? "Appears on the homepage; people can ask to join." : "Invite-only. Stays off the public site."}</div>
              </button>
            ))}
          </div>

          <Field label="Category">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setVenueId(null); }} className="input">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </Field>

          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Sunday morning hike + brunch" />
          </Field>

          <Field label="Pitch / description" hint="What's the vibe?">
            <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={3} className="input resize-none" />
          </Field>

          <Field label="When" hint="To the nearest 15 minutes.">
            <input type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          </Field>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-primary">Venue</div>
              <div className="flex items-center gap-1 text-xs">
                <button type="button" onClick={() => { setUseCustom(false); }} className={`px-3 py-1 rounded-full ${!useCustom ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pick existing</button>
                <button type="button" onClick={() => { setUseCustom(true); setVenueId(null); }} className={`px-3 py-1 rounded-full ${useCustom ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Custom</button>
              </div>
            </div>
            {!useCustom ? (
              venues.length === 0 ? <Empty>No venues for this category yet.</Empty> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {venues.map(v => (
                    <button type="button" key={v.id} onClick={() => setVenueId(v.id)} className={`text-left rounded-xl border p-3 ${venueId === v.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                      <div className="font-medium text-primary">{v.name}</div>
                      {v.location && <div className="text-xs text-muted-foreground">{v.location}</div>}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} className="input" placeholder="Venue name" />
                <input value={customLoc} onChange={(e) => setCustomLoc(e.target.value)} className="input" placeholder="Address / location" />
                <input value={customImg} onChange={(e) => setCustomImg(e.target.value)} className="input" placeholder="Image URL (optional)" />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-primary">Invitees {visibility === "private" && <span className="text-xs text-muted-foreground">(required)</span>}</div>
              <button type="button" onClick={addInvitee} className="text-xs inline-flex items-center gap-1 text-primary hover:underline"><Plus className="size-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {invitees.map((inv, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input value={inv.name} onChange={(e) => updInvitee(i, "name", e.target.value)} className="input" placeholder="Name" />
                  <input value={inv.email} onChange={(e) => updInvitee(i, "email", e.target.value)} type="email" className="input" placeholder="email@example.com" />
                  <button type="button" onClick={() => removeInvitee(i)} className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-border px-5 py-2.5 text-sm hover:bg-muted">Cancel</button>
          <button disabled={busy} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create & invite
          </button>
        </div>

        <style>{`.input { width:100%; border-radius: 0.75rem; border:1px solid var(--color-input); background: var(--color-background); padding: 0.7rem 0.9rem; font-size: 0.9rem; outline:none; }
          .input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 18%, transparent); }`}</style>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-primary">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function VenuesTab() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cat, setCat] = useState<string>(CATEGORIES[0].id);
  const [form, setForm] = useState({ name: "", description: "", location: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const listVenues = useServerFn(adminListVenues);
  const addVenue = useServerFn(adminAddVenue);
  const deleteVenue = useServerFn(adminDeleteVenue);

  async function load() {
    const r = await listVenues({ data: { adminPassword: ADMIN_PASSWORD } });
    setVenues((r.venues ?? []) as Venue[]);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await addVenue({
      data: {
        adminPassword: ADMIN_PASSWORD,
        category: cat,
        name: form.name,
        description: form.description || null,
        location: form.location || null,
        image_url: form.image_url || null,
      },
    });
    setSaving(false);
    if (!res.ok) { toast.error("Couldn't add"); return; }
    setForm({ name: "", description: "", location: "", image_url: "" });
    toast.success("Added");
    load();
  }

  async function del(id: string) {
    if (!confirm("Remove this venue?")) return;
    await deleteVenue({ data: { adminPassword: ADMIN_PASSWORD, id } });
    load();
  }


  const byCat = CATEGORIES.map(c => ({ ...c, items: venues.filter(v => v.category === c.id) }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        {byCat.map((g) => (
          <section key={g.id}>
            <h3 className="font-display text-xl text-primary mb-3">{g.emoji} {g.label} <span className="text-muted-foreground text-sm">({g.items.length})</span></h3>
            {g.items.length === 0 ? (
              <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-4">No venues yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {g.items.map((v) => (
                  <div key={v.id} className="rounded-2xl bg-card border border-border/60 p-4 flex gap-3 items-start">
                    {v.image_url && <img src={v.image_url} alt="" className="size-16 rounded-xl object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-primary truncate">{v.name}</div>
                      {v.location && <div className="text-xs text-muted-foreground">{v.location}</div>}
                      {v.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{v.description}</div>}
                    </div>
                    <button onClick={() => del(v.id)} className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <form onSubmit={add} className="rounded-3xl bg-card border border-border/60 p-5 h-fit sticky top-6 shadow-soft">
        <h3 className="font-display text-lg text-primary flex items-center gap-2"><Plus className="size-4" /> Add a venue</h3>
        <label className="block mt-4">
          <span className="text-xs font-medium text-primary">Category</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </label>
        {(["name", "location", "image_url", "description"] as const).map((k) => (
          <label key={k} className="block mt-3">
            <span className="text-xs font-medium text-primary capitalize">{k.replace("_", " ")}</span>
            <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
          </label>
        ))}
        <button disabled={saving} className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? "Adding…" : "Add venue"}
        </button>
      </form>
    </div>
  );
}
