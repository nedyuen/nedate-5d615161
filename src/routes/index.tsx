import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import nedHero from "@/assets/ned-hero.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Clock, MapPin, Sparkles } from "lucide-react";
import { listUpcomingPublicHangouts } from "@/lib/hangouts.functions";
import { categoryMeta, fmtRange, venueDisplay } from "@/lib/nedate";

const BUCKET_CATEGORY = "ned's bucket list item";

type Venue = { id: string; name: string; description: string | null; location: string | null; image_url: string | null; category: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nedate — Hang out with Ned" },
      { name: "description", content: "Want to grab dinner, visit a theme park, try a new restaurant, or do something interesting together? Send Ned a request." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [bucketVenues, setBucketVenues] = useState<Venue[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const fetchUpcoming = useServerFn(listUpcomingPublicHangouts);
  useEffect(() => {
    supabase.from("venues").select("*").eq("category", BUCKET_CATEGORY).then(({ data }) => {
      setBucketVenues((data ?? []) as Venue[]);
    });
    fetchUpcoming().then((r) => setUpcoming(r.hangouts ?? []));
  }, [fetchUpcoming]);
  return (
    <div className="min-h-screen bg-background">
      {/* nav */}
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <Link
            to="/request"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90 transition"
          >
            Request a meetup <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="px-5 pt-10 pb-16 sm:px-10 sm:pt-20 sm:pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 sm:gap-16 md:grid-cols-2 md:items-center">
          <div className="order-2 md:order-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> A personal invitation platform
            </div>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] text-primary sm:text-7xl text-balance">
              Hang out<br/>with Ned.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground text-balance">
              Want to grab dinner, visit a theme park, try a new restaurant, or do something
              interesting together? Send me a request.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/request"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground shadow-warm hover:bg-primary/90 transition"
              >
                Request a Meetup <ArrowRight className="size-4" />
              </Link>
              <a
                href="#ideas"
                className="inline-flex items-center rounded-full border border-primary/15 bg-card px-7 py-4 text-base font-medium text-primary hover:bg-accent/15 transition"
              >
                Browse ideas
              </a>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative">
              <div className="absolute -inset-3 rounded-[2rem] bg-accent/30 rotate-2" aria-hidden />
              <img
                src={nedHero.url}
                alt="Ned smiling"
                width={1024}
                height={1024}
                className="relative aspect-square w-full rounded-[2rem] object-cover shadow-warm"
              />
              <div className="absolute -bottom-5 -left-5 hidden sm:flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-soft">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Currently saying yes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* upcoming hangouts */}
      {upcoming.length > 0 && (
        <section className="px-5 pb-16 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <h2 className="font-display text-3xl text-primary sm:text-4xl">Ned's Existing Plans</h2>
              <p className="mt-2 text-muted-foreground">Latest hangouts open to friends. Ask to join one.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((h) => {
                const meta = categoryMeta(h.category);
                const v = venueDisplay(h);
                return (
                  <Link
                    key={h.id}
                    to="/join/$slug"
                    params={{ slug: h.slug }}
                    className="group relative overflow-hidden rounded-3xl bg-card shadow-soft hover:shadow-warm transition border border-border/50"
                  >
                    {v.imageUrl && (
                      <img src={v.imageUrl} alt={v.name} className="aspect-[16/10] w-full object-cover group-hover:scale-[1.02] transition" loading="lazy" />
                    )}
                    <div className="p-5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.emoji} {meta.label}</div>
                      <div className="mt-1 font-display text-xl text-primary">{h.title ?? "A hangout with Ned"}</div>
                      {h.pitch && <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{h.pitch}</div>}
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Clock className="size-3.5" /> {fmtRange(h.start_time)}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {v.name}{v.location ? ` · ${v.location}` : ""}</div>
                      </div>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                        Ask to join <ArrowRight className="size-4 group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ideas */}
      <section id="ideas" className="px-5 pb-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-3xl text-primary sm:text-4xl">Ned's Bucket List</h2>
              <p className="mt-2 text-muted-foreground">Want to invite me to hang, but not sure what to do? Why not help me cross something off my bucket list.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bucketVenues.map((v) => (
              <Link
                key={v.id}
                to="/request"
                search={{ cat: BUCKET_CATEGORY, venue: v.id }}
                className="group relative overflow-hidden rounded-3xl bg-card shadow-soft hover:shadow-warm transition border border-border/50"
              >
                {v.image_url && (
                  <img src={v.image_url} alt={v.name} className="aspect-[16/10] w-full object-cover group-hover:scale-[1.02] transition" loading="lazy" />
                )}
                <div className="p-5">
                  <div className="font-display text-xl text-primary">{v.name}</div>
                  {v.description && <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{v.description}</div>}
                  {v.location && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" /> {v.location}
                    </div>
                  )}
                  <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Plan this with Ned <ArrowRight className="size-4 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              </Link>
            ))}
            {bucketVenues.length === 0 && (
              <div className="col-span-full rounded-3xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
                Ned's bucket list is empty right now. Check back soon.
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="px-5 pb-10 sm:px-10">
        <div className="mx-auto max-w-6xl border-t border-border/60 pt-6 text-sm text-muted-foreground flex justify-between flex-wrap gap-3">
          <span>© Nedate. Turning plans into memories.</span>
          <Link to="/admin" className="hover:text-primary">Admin</Link>
        </div>
      </footer>
    </div>
  );
}
