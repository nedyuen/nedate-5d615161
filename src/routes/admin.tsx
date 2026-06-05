import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PASSWORD, ADMIN_STORAGE_KEY, CATEGORIES, categoryMeta, fmtRange } from "@/lib/nedate";
import { Check, Loader2, LogOut, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Nedate" }] }),
  component: AdminPage,
});

type Req = {
  id: string; slug: string; category: string; requester_name: string; requester_email: string;
  pitch: string; start_time: string; end_time: string; status: string; admin_comment: string | null;
  custom_venue: string | null; created_at: string;
  venue: { name: string; location: string | null } | null;
};
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
  const [tab, setTab] = useState<"requests" | "venues">("requests");
  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <button onClick={onLogout} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><LogOut className="size-4" /> Log out</button>
        </div>
        <div className="mx-auto max-w-6xl mt-8 flex items-center gap-2 border-b border-border/60">
          {(["requests", "venues"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>
              {t === "requests" ? "Requests" : "Venues & ideas"}
            </button>
          ))}
        </div>
      </header>
      <main className="px-5 py-8 sm:px-10">
        <div className="mx-auto max-w-6xl">
          {tab === "requests" ? <RequestsTab /> : <VenuesTab />}
        </div>
      </main>
    </div>
  );
}

function RequestsTab() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Req | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("requests").select("*, venue:venues(name, location)").order("created_at", { ascending: false });
    setReqs((data ?? []) as Req[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const grouped = { pending: reqs.filter(r => r.status === "pending"), approved: reqs.filter(r => r.status === "approved"), rejected: reqs.filter(r => r.status === "rejected") };

  return (
    <div>
      {loading && <div className="text-muted-foreground">Loading…</div>}
      {(["pending", "approved", "rejected"] as const).map((s) => (
        <section key={s} className="mb-10">
          <h2 className="font-display text-2xl text-primary capitalize mb-4">{s} <span className="text-muted-foreground text-base">({grouped[s].length})</span></h2>
          {grouped[s].length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6">Nothing here yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[s].map((r) => (
                <button key={r.id} onClick={() => setActive(r)} className="text-left rounded-2xl bg-card border border-border/60 p-5 shadow-soft hover:border-primary/40 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{categoryMeta(r.category).emoji} {categoryMeta(r.category).label}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 font-display text-lg text-primary">{r.requester_name}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">"{r.pitch}"</div>
                  <div className="mt-3 text-xs text-muted-foreground">{fmtRange(r.start_time, r.end_time)}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
      {active && <RequestModal req={active} onClose={() => setActive(null)} onUpdated={() => { load(); setActive(null); }} />}
    </div>
  );
}

function RequestModal({ req, onClose, onUpdated }: { req: Req; onClose: () => void; onUpdated: () => void }) {
  const [comment, setComment] = useState(req.admin_comment ?? "");
  const [saving, setSaving] = useState<string | null>(null);

  async function decide(status: "approved" | "rejected") {
    setSaving(status);
    const { error } = await supabase.from("requests").update({ status, admin_comment: comment.trim() || null, updated_at: new Date().toISOString() }).eq("id", req.id);
    setSaving(null);
    if (error) { toast.error("Update failed"); return; }
    toast.success(`Marked ${status}`);
    onUpdated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-3xl bg-card border border-border/60 p-7 shadow-warm max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{categoryMeta(req.category).emoji} {categoryMeta(req.category).label}</div>
            <h2 className="font-display text-2xl text-primary mt-1">{req.requester_name}</h2>
            <a href={`mailto:${req.requester_email}`} className="text-sm text-muted-foreground hover:text-primary">{req.requester_email}</a>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="mt-5 rounded-2xl bg-background border border-border/60 p-4">
          <div className="text-xs text-muted-foreground mb-1">Pitch</div>
          <p className="italic">"{req.pitch}"</p>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div><span className="text-muted-foreground">When: </span>{fmtRange(req.start_time, req.end_time)}</div>
          <div><span className="text-muted-foreground">Where: </span>{req.venue?.name ?? req.custom_venue ?? "—"}{req.venue?.location ? ` · ${req.venue.location}` : ""}{!req.venue && req.custom_venue ? " (proposed)" : ""}</div>
          <div><span className="text-muted-foreground">Status: </span><span className="capitalize">{req.status}</span></div>
          <div className="text-xs text-muted-foreground pt-1">
            Link: <Link to="/r/$slug" params={{ slug: req.slug }} className="underline">/r/{req.slug}</Link>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-primary">Note (optional)</span>
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
      </div>
    </div>
  );
}

function VenuesTab() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cat, setCat] = useState<string>(CATEGORIES[0].id);
  const [form, setForm] = useState({ name: "", description: "", location: "", image_url: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("venues").select("*").order("category").order("name");
    setVenues((data ?? []) as Venue[]);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("venues").insert({ category: cat, ...form, description: form.description || null, location: form.location || null, image_url: form.image_url || null });
    setSaving(false);
    if (error) { toast.error("Couldn't add"); return; }
    setForm({ name: "", description: "", location: "", image_url: "" });
    toast.success("Added");
    load();
  }

  async function del(id: string) {
    if (!confirm("Remove this venue?")) return;
    await supabase.from("venues").delete().eq("id", id);
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
