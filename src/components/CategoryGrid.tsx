import { Image, FileText, Music, Video, Archive, Code2, type LucideIcon } from "lucide-react";

type Category = {
  icon: LucideIcon;
  name: string;
  formats: string[];
  hue: string;
};

const categories: Category[] = [
  { icon: Image, name: "Image Converter", formats: ["JPG", "PNG", "WEBP", "SVG", "GIF"], hue: "from-orange-500/15 to-amber-500/10" },
  { icon: FileText, name: "Document Converter", formats: ["PDF", "DOCX", "TXT", "XLSX"], hue: "from-blue-500/15 to-cyan-500/10" },
  { icon: Music, name: "Audio Converter", formats: ["MP3", "WAV", "FLAC", "AAC"], hue: "from-pink-500/15 to-rose-500/10" },
  { icon: Video, name: "Video Converter", formats: ["MP4", "AVI", "MOV", "MKV"], hue: "from-purple-500/15 to-fuchsia-500/10" },
  { icon: Archive, name: "Archive Converter", formats: ["ZIP", "RAR", "7Z"], hue: "from-emerald-500/15 to-teal-500/10" },
  { icon: Code2, name: "Code Converter", formats: ["JSON", "XML", "YAML", "HTML"], hue: "from-yellow-500/15 to-orange-500/10" },
];

export function CategoryGrid() {
  return (
    <section id="tools" className="container mx-auto px-4 md:px-6 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Convert anything</h2>
        <p className="mt-3 text-muted-foreground">Choose a category and start converting in seconds. 1000+ formats supported.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
          <button
            key={c.name}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`group relative overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-glow)] animate-[fade-up_0.6s_ease-out_both]`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${c.hue} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-md group-hover:scale-110 transition-transform">
                <c.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{c.name}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.formats.map((f) => (
                  <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
