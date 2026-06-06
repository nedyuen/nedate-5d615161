import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryMeta, type CategoryId } from "@/lib/nedate";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { sendRequestConfirmation } from "@/lib/email.functions";
import { fmtRange } from "@/lib/nedate";

const searchSchema = z.object({ cat: z.string().optional(), venue: z.string().optional() });

export const Route = createFileRoute("/request")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Request a Meetup — Nedate" }] }),
  component: RequestPage,
});

type Venue = { id: string; name: string; description: string | null; location: string | null; image_url: string | null; category: string };

function RequestPage() {
  const { cat, venue } = Route.useSearch();
  const navigate = useNavigate();
  const venuePreset = !!venue;
  const [step, setStep] = useState(cat ? 2 : 1);
  const [category, setCategory] = useState<string>(cat ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pitch, setPitch] = useState("");
  const [start, setStart] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string | null>(venue ?? null);
  const [customVenue, setCustomVenue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const totalSteps = venuePreset ? 3 : 4;

  useEffect(() => {
    if (!category) return;
    supabase.from("venues").select("*").eq("category", category).then(({ data }) => {
      setVenues((data ?? []) as Venue[]);
    });
  }, [category]);

  const canNext = () => {
    if (step === 1) return !!category;
    if (step === 2) return name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && pitch.trim().length >= 10;
    if (step === 3) return !!start;
    return false;
  };

  async function submit() {
    if (!venueId && customVenue.trim().length < 3) {
      toast.error("Pick a place or suggest one");
      return;
    }
    setSubmitting(true);
    const startIso = new Date(start).toISOString();
    const { data, error } = await supabase.from("requests").insert({
      category, requester_name: name, requester_email: email, pitch,
      start_time: startIso, end_time: null,
      venue_id: venueId, custom_venue: venueId ? null : customVenue.trim(),
    }).select("slug").single();
    if (error || !data) { setSubmitting(false); toast.error("Couldn't send your request"); return; }
    const chosenVenue = venues.find((v) => v.id === venueId);
    const venueText = chosenVenue
      ? chosenVenue.name + (chosenVenue.location ? ` · ${chosenVenue.location}` : "")
      : customVenue.trim();
    try {
      await sendRequestConfirmation({
        data: {
          to: email,
          name,
          pitch,
          venue: venueText,
          when: fmtRange(startIso),
          trackingUrl: `${window.location.origin}/r/${data.slug}`,
        },
      });
    } catch (e) {
      console.error("Confirmation email failed", e);
    }
    setSubmitting(false);
    navigate({ to: "/r/$slug", params: { slug: data.slug } });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-2xl text-primary">Nedate</Link>
          <div className="text-sm text-muted-foreground">Step {step - (cat ? 1 : 0)} of {totalSteps - (cat ? 1 : 0)}</div>
        </div>
        <div className="mx-auto mt-4 max-w-3xl">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${((step - (cat ? 1 : 0)) / (totalSteps - (cat ? 1 : 0))) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="px-5 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          {step === 1 && (
            <Section title="What should we do?" subtitle="Pick a category. You can describe more in the next step.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setCategory(c.id); setVenueId(null); setStep(2); }}
                      className={`group rounded-3xl border p-5 text-left transition shadow-soft ${active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card hover:border-primary/40"}`}
                    >
                      <div className="text-3xl">{c.emoji}</div>
                      <div className={`mt-3 font-display text-lg ${active ? "" : "text-primary"}`}>{c.label}</div>
                      <div className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{c.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section title="Who's asking?" subtitle="Tell me who you are and pitch the hang.">
              <div className="space-y-4">
                <Field label="Your name">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Alex Rivera" />
                </Field>
                <Field label="Email" hint="We'll use this to send you a confirmation and to let you know once Ned responds.">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="alex@example.com" />
                </Field>
                <Field label="Pitch the date" hint="Why would this be fun? What's the spark?">
                  <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={5} className="input resize-none" placeholder="I've been meaning to try that new ramen spot and I think you'd love it. Wanna make a night of it?" />
                </Field>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="When?" subtitle="Propose a time. We can always adjust.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="When" hint="Pick to the nearest 15 minutes.">
                  <input type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="input" />
                </Field>
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section title="Where?" subtitle={`Suggested ${categoryMeta(category).label.toLowerCase()} spots — or pitch your own.`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {venues.map((v) => {
                  const active = venueId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => { setVenueId(v.id); setCustomVenue(""); }}
                      className={`overflow-hidden rounded-3xl border text-left transition shadow-soft ${active ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40"}`}
                    >
                      {v.image_url && (
                        <img src={v.image_url} alt={v.name} className="aspect-[16/10] w-full object-cover" loading="lazy" />
                      )}
                      <div className="bg-card p-4">
                        <div className="font-display text-lg text-primary">{v.name}</div>
                        {v.description && <div className="mt-1 text-sm text-muted-foreground">{v.description}</div>}
                        {v.location && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3.5" /> {v.location}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                <div className={`rounded-3xl border p-4 ${!venueId && customVenue ? "border-primary ring-2 ring-primary/30" : "border-dashed border-border/80"} bg-card`}>
                  <div className="font-display text-lg text-primary">Suggest somewhere else</div>
                  <p className="mt-1 text-sm text-muted-foreground">Have a place in mind? Drop it here.</p>
                  <input
                    value={customVenue}
                    onChange={(e) => { setCustomVenue(e.target.value); setVenueId(null); }}
                    className="input mt-3"
                    placeholder="That place on 4th & Pine"
                  />
                </div>
              </div>
            </Section>
          )}

          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(cat ? 2 : 1, s - 1))}
              disabled={step === (cat ? 2 : 1)}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm text-muted-foreground hover:text-primary disabled:opacity-30"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            {step < totalSteps ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90 transition disabled:opacity-40"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-warm hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Send request
              </button>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .input { width:100%; border-radius: 1rem; border:1px solid var(--color-input); background: var(--color-card); padding: 0.85rem 1rem; font-size: 0.95rem; outline:none; transition: border-color .15s, box-shadow .15s; }
        .input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 18%, transparent); }
      `}</style>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-4xl text-primary sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-2 text-muted-foreground text-balance">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-primary">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
