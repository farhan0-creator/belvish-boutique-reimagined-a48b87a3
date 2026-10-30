import { useState } from "react";
import { findMatches, type Family, type Occasion } from "@/lib/catalog";
import { ProductCard } from "./Shell";

const familyOpts: [Family | "", string][] = [["", "Choose a scent family"], ["Fresh", "Fresh and bright"], ["Citrus", "Citrus and sunlit"], ["Woody", "Woods and soft warmth"], ["Floral", "Florals and petals"], ["Amber", "Amber and spice"], ["Gourmand", "Soft, sweet gourmand"], ["Musky", "Clean, musky skin scents"]];
const occOpts: [Occasion | "", string][] = [["", "Any moment"], ["Everyday", "Everyday"], ["Work", "Work"], ["A bright day", "A bright day"], ["An evening out", "An evening out"]];
const budgetOpts: [number, string][] = [[0, "Show me everything"], [15000, "Under ₹15,000"], [25000, "Under ₹25,000"], [40000, "Under ₹40,000"]];

function Choice<T extends string | number>({ label, opts, value, onChange }: { label: string; opts: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-xl">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={`border px-4 py-2 text-sm transition-colors ${value === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Finder() {
  const [family, setFamily] = useState<Family | "">("");
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [budget, setBudget] = useState(0);
  const [shown, setShown] = useState(false);
  const results = findMatches(family, occasion, budget);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your scent, your terms · Build your fragrance brief</p>
      <div className="mt-8 space-y-8">
        <Choice label="01 / What do you gravitate towards?" opts={familyOpts} value={family} onChange={setFamily} />
        <Choice label="02 / When would you wear it?" opts={occOpts} value={occasion} onChange={setOccasion} />
        <Choice label="03 / Your comfortable budget" opts={budgetOpts} value={budget} onChange={setBudget} />
      </div>
      <button onClick={() => setShown(true)} className="mt-10 bg-primary px-8 py-3 text-xs uppercase tracking-[0.2em] text-primary-foreground">Show my starting points</button>
      {shown && (
        <div className="mt-10">
          {results.length === 0 ? (
            <p className="text-muted-foreground">Nothing in the collection fits all three — try loosening one answer.</p>
          ) : (
            <>
              <p className="mb-6 font-display text-2xl">{results.length} starting point{results.length > 1 ? "s" : ""} for you</p>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{results.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
