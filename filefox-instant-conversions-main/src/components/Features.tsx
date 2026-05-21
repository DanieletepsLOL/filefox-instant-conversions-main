import { Lock, EyeOff, Zap, ServerOff } from "lucide-react";

const features = [
  { icon: Lock, title: "Secure", desc: "End-to-end encryption on every upload and conversion." },
  { icon: EyeOff, title: "Privacy First", desc: "Files auto-delete within 1 hour. We never look." },
  { icon: Zap, title: "Fast Conversion", desc: "Optimized engine processes files in seconds." },
  { icon: ServerOff, title: "No File Storage", desc: "Zero retention. Your files never persist on our servers." },
];

export function Features() {
  return (
    <section className="container mx-auto px-4 md:px-6 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for trust</h2>
        <p className="mt-3 text-muted-foreground">Speed without compromise on privacy.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-glow)] transition-shadow">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
