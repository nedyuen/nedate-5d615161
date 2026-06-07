import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHangoutBySlug, submitJoinRequest } from "@/lib/hangouts.functions";
import { categoryMeta, fmtRange, venueDisplay } from "@/lib/nedate";
import { ArrowLeft, Check, Clock, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$slug")({
  head: () => ({ meta: [{ title: "Join a hangout — Nedate" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchHangout = useServerFn(getPublicHangoutBySlug);
  const submit = useServerFn(submitJoinRequest);
  const [hangout, setHangout] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchHangout({ data: { slug } }).then((r) => {
      setHangout(r.hangout);
      setLoading(false);
    });
  }, [fetchHangout, slug]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!hangout) return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="text-center">
        <h1 className="font-display text-3xl text-primary">Hangout not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  );

  const meta = categoryMeta(hangout.category);
  const v = venueDisplay(hangout);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || !/\S+@\S+\.\S+/.test(email)) {
      toast.error("Add your name and a valid email");
      return;
    }
    setBusy(true);
    const res = await submit({ data: { slug, name: name.trim(), email: email.trim(), message: message.trim() || null } });
    setBusy(false);
    if (!res.ok) {
      toast.error("Couldn't send your request");
      return;
    }
    toast.success("Request sent");
    navigate({ to: "/r/$slug", params: { slug: res.slug! } });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
      </header>

      <main className="px-5 py-10 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.emoji} {meta.label}</div>
          <h1 className="mt-2 font-display text-4xl text-primary sm:text-5xl text-balance">{hangout.title ?? "Join Ned's hangout"}</h1>
          {hangout.pitch && <p className="mt-3 text-muted-foreground text-balance">{hangout.pitch}</p>}

          <div className="mt-6 rounded-3xl bg-card border border-border/60 shadow-soft overflow-hidden">
            {v.imageUrl && <img src={v.imageUrl} alt={v.name} className="aspect-[2/1] w-full object-cover" />}
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm"><MapPin className="size-4 text-primary" /> {v.name}{v.location ? ` · ${v.location}` : ""}</div>
              <div className="flex items-center gap-2 text-sm"><Clock className="size-4 text-primary" /> {fmtRange(hangout.start_time)}</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-8 rounded-3xl bg-card border border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-2xl text-primary">Ask to join</h2>
            <p className="text-sm text-muted-foreground">Ned will review and get back to you by email.</p>
            <label className="block">
              <span className="block text-sm font-medium text-primary">Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Alex Rivera" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-primary">Email</span>
              <span className="block text-xs text-muted-foreground">We'll use this to send you a confirmation and Ned's reply.</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="alex@example.com" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-primary">Message (optional)</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary resize-none" placeholder="Excited to join — bringing snacks!" />
            </label>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Send request
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
