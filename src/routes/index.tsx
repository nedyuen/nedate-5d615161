import { createFileRoute, Link } from "@tanstack/react-router";
import nedHero from "@/assets/ned-hero.jpg";
import { CATEGORIES } from "@/lib/nedate";
import { ArrowRight, Sparkles } from "lucide-react";

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
                src={nedHero}
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

      {/* ideas */}
      <section id="ideas" className="px-5 pb-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-3xl text-primary sm:text-4xl">What should we do?</h2>
              <p className="mt-2 text-muted-foreground">Pick a vibe. We'll figure out the rest together.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                to="/request"
                search={{ cat: c.id }}
                className="group relative overflow-hidden rounded-3xl bg-card p-5 sm:p-6 shadow-soft hover:shadow-warm transition border border-border/50"
              >
                <div className="text-4xl sm:text-5xl">{c.emoji}</div>
                <div className="mt-4 font-display text-xl text-primary">{c.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{c.blurb}</div>
                <ArrowRight className="absolute top-5 right-5 size-4 text-primary/30 group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-5 pb-10 sm:px-10">
        <div className="mx-auto max-w-6xl border-t border-border/60 pt-6 text-sm text-muted-foreground flex justify-between flex-wrap gap-3">
          <span>© Nedate. Made with care.</span>
          <Link to="/admin" className="hover:text-primary">Admin</Link>
        </div>
      </footer>
    </div>
  );
}
