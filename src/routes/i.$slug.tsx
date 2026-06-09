import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInviteByToken, respondToInvite } from "@/lib/hangouts.functions";
import { categoryMeta, fmtRange, venueDisplay } from "@/lib/nedate";
import { Check, Clock, HelpCircle, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { HangoutAgreementPanel } from "@/components/HangoutAgreementPanel";

export const Route = createFileRoute("/i/$slug")({
  head: () => ({ meta: [{ title: "Your invite — Nedate" }] }),
  component: InvitePage,
});

type Response = "accepted" | "declined" | "maybe";

function InvitePage() {
  const { slug } = Route.useParams();
  const fetchInvite = useServerFn(getInviteByToken);
  const respond = useServerFn(respondToInvite);
  const [data, setData] = useState<{ invite: any | null; hangout: any | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Response | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Response | null>(null);

  useEffect(() => {
    fetchInvite({ data: { slug } }).then((r) => {
      setData(r);
      if (r.invite?.response_status && r.invite.response_status !== "pending") {
        setDone(r.invite.response_status as Response);
        setChoice(r.invite.response_status as Response);
        setComment(r.invite.comment ?? "");
      }
      setLoading(false);
    });
  }, [fetchInvite, slug]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!data?.invite || !data.hangout) return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="text-center">
        <h1 className="font-display text-3xl text-primary">Invite not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  );

  const { invite, hangout } = data;
  const meta = categoryMeta(hangout.category);
  const v = venueDisplay(hangout);

  async function submitResponse() {
    if (!choice) return;
    setBusy(true);
    const res = await respond({ data: { slug, response: choice, comment: comment.trim() || null } });
    setBusy(false);
    if (!res.ok) { toast.error("Couldn't save"); return; }
    setDone(choice);
    toast.success("Thanks — Ned knows");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
        </div>
      </header>

      <main className="px-5 py-10 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.emoji} {meta.label}</div>
          <h1 className="mt-2 font-display text-4xl text-primary sm:text-5xl text-balance">Hi {invite.name} — Ned wants to hang out</h1>
          <p className="mt-3 text-lg text-primary">{hangout.title ?? "A hangout"}</p>
          {hangout.pitch && <p className="mt-2 text-muted-foreground">{hangout.pitch}</p>}

          <div className="mt-6 rounded-3xl bg-card border border-border/60 shadow-soft overflow-hidden">
            {v.imageUrl && <img src={v.imageUrl} alt={v.name} className="aspect-[2/1] w-full object-cover" />}
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm"><MapPin className="size-4 text-primary" /> {v.name}{v.location ? ` · ${v.location}` : ""}</div>
              <div className="flex items-center gap-2 text-sm"><Clock className="size-4 text-primary" /> {fmtRange(hangout.start_time)}</div>
            </div>
          </div>

          {done ? (
            <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6 shadow-soft">
              <h2 className="font-display text-2xl text-primary">
                You replied: {done === "accepted" ? "✅ Yes" : done === "maybe" ? "🤔 Maybe" : "❌ No"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Changed your mind? Pick again and resubmit.</p>
              <Picker choice={choice} setChoice={setChoice} />
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary resize-none" placeholder="Optional comment for Ned" />
              <button disabled={busy || !choice} onClick={submitResponse} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Update response
              </button>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6 shadow-soft">
              <h2 className="font-display text-2xl text-primary">Can you make it?</h2>
              <Picker choice={choice} setChoice={setChoice} />
              <label className="block mt-4">
                <span className="block text-sm font-medium text-primary">Note for Ned (optional)</span>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary resize-none" placeholder="Looking forward to it!" />
              </label>
              <button disabled={busy || !choice} onClick={submitResponse} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Send reply
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Picker({ choice, setChoice }: { choice: Response | null; setChoice: (r: Response) => void }) {
  const opts: { id: Response; label: string; icon: any; cls: string }[] = [
    { id: "accepted", label: "Yes, I'm in", icon: Check, cls: "border-emerald-500/40" },
    { id: "maybe", label: "Maybe", icon: HelpCircle, cls: "border-accent" },
    { id: "declined", label: "Can't make it", icon: X, cls: "border-red-500/40" },
  ];
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {opts.map((o) => {
        const Icon = o.icon;
        const active = choice === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setChoice(o.id)}
            className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : `${o.cls} hover:border-primary/40`}`}
          >
            <Icon className="size-5 text-primary" />
            <div className="mt-2 font-medium text-primary">{o.label}</div>
          </button>
        );
      })}
    </div>
  );
}
