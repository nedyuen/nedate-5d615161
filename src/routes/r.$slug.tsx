import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRequestTracking } from "@/lib/hangouts.functions";
import { categoryMeta, fmtRange, venueDisplay } from "@/lib/nedate";
import { Check, Clock, MapPin, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { HangoutAgreementPanel } from "@/components/HangoutAgreementPanel";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({ meta: [{ title: "Your request — Nedate" }] }),
  component: StatusPage,
});

type Req = {
  id: string; slug: string; category: string; requester_name: string | null; pitch: string | null;
  start_time: string; end_time: string | null; request_status: string | null;
  hangout_kind: string; admin_comment: string | null;
  custom_venue_name: string | null; custom_venue_location: string | null; custom_venue_image_url: string | null;
  parent_hangout_id: string | null; request_message: string | null;
  venue: { name: string; location: string | null; image_url: string | null } | null;
};

function StatusPage() {
  const { slug } = Route.useParams();
  const fetchTracking = useServerFn(getRequestTracking);
  const [req, setReq] = useState<Req | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTracking({ data: { slug } }).then((r) => {
      setReq((r.request as any) ?? null);
      setLoading(false);
    });
  }, [fetchTracking, slug]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!req) return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="text-center">
        <h1 className="font-display text-3xl text-primary">Request not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  );

  const meta = categoryMeta(req.category);
  const status = req.request_status ?? "pending";
  const v = venueDisplay(req);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto max-w-2xl flex justify-between items-center">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <Copy className="size-3.5" /> Copy link
          </button>
        </div>
      </header>

      <main className="px-5 py-10 sm:px-10">
        <div className="mx-auto max-w-2xl">
          <StatusBadge status={status} />

          <h1 className="mt-5 font-display text-4xl text-primary sm:text-5xl text-balance">
            {status === "approved" && "Ned said yes ✨"}
            {status === "rejected" && "Not this time"}
            {status === "pending" && "Sitting in Ned's inbox"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {status === "pending" && "Your request is on its way. You'll know the moment Ned responds."}
            {status === "approved" && "It's a date. Details below — Ned will reach out by email."}
            {status === "rejected" && "Ned can't make this one work. See his note below."}
          </p>

          {req.admin_comment && (
            <div className="mt-6 rounded-3xl bg-accent/15 p-5 border border-accent/30">
              <div className="text-xs font-medium text-primary mb-1">A note from Ned</div>
              <div className="text-foreground">{req.admin_comment}</div>
            </div>
          )}

          <div className="mt-8 rounded-3xl bg-card border border-border/60 shadow-soft overflow-hidden">
            {v.imageUrl && (
              <img src={v.imageUrl} alt={v.name} className="aspect-[2/1] w-full object-cover" />
            )}
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.emoji} {meta.label}</div>
                <div className="mt-1 font-display text-2xl text-primary">{v.name}</div>
                {v.location && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {v.location}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Clock className="size-4 mt-0.5 text-primary" />
                <span>{fmtRange(req.start_time, req.end_time)}</span>
              </div>
              {(req.pitch || req.request_message) && (
                <div className="pt-4 border-t border-border/60">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">From {req.requester_name ?? "you"}</div>
                  <p className="text-foreground italic">"{req.request_message ?? req.pitch}"</p>
                </div>
              )}
            </div>
          </div>

          <HangoutAgreementPanel actor={{ kind: "slug", slug }} />


          <div className="mt-8 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90 transition"
            >
              Back to home
            </Link>
            <div className="text-xs text-muted-foreground">Request ID: {req.slug}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Pill className="bg-emerald-100 text-emerald-800"><Check className="size-3.5" /> Approved</Pill>;
  if (status === "rejected") return <Pill className="bg-red-100 text-red-800"><X className="size-3.5" /> Declined</Pill>;
  return <Pill className="bg-accent/25 text-primary"><Clock className="size-3.5" /> Pending</Pill>;
}
function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${className}`}>{children}</span>;
}
