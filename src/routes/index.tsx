import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { UploadZone } from "@/components/UploadZone";
import { CategoryGrid } from "@/components/CategoryGrid";
import { Features } from "@/components/Features";
import { AdSlot } from "@/components/AdSlot";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Filefox — Convert Files Instantly" },
      { name: "description", content: "Fast, secure and private file conversion for 1000+ formats. Images, documents, audio, video and more." },
      { property: "og:title", content: "Filefox — Convert Files Instantly" },
      { property: "og:description", content: "Fast, secure and private file conversion for 1000+ formats." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Header ad */}
        <div className="container mx-auto px-4 md:px-6 pt-4">
          <AdSlot label="Advertisement space" height="h-24" />
        </div>

        {/* Hero */}
        <section id="converter" className="container mx-auto px-4 md:px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <div className="text-center max-w-3xl mx-auto mb-12 animate-[fade-up_0.7s_ease-out]">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.02]">
              Convert Files <span className="text-gradient">Instantly</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              Fast, secure and private file conversion for 1000+ formats including images, documents, audio and video.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              1000+ formats supported
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-stretch">
            <UploadZone />
            <aside className="hidden lg:block">
              <AdSlot label="Advertisement space" height="h-full min-h-[420px]" />
            </aside>
          </div>
        </section>

        {/* Between-section ad */}
        <div className="container mx-auto px-4 md:px-6">
          <AdSlot label="Sponsored" height="h-24" />
        </div>

        <CategoryGrid />

        {/* Between-section ad */}
        <div className="container mx-auto px-4 md:px-6">
          <AdSlot label="Advertisement" height="h-24" />
        </div>

        <Features />

        {/* Pricing teaser */}
        <section id="pricing" className="container mx-auto px-4 md:px-6 py-20">
          <div className="rounded-3xl border bg-gradient-to-br from-primary to-[var(--primary-glow)] p-10 md:p-16 text-center text-primary-foreground shadow-[var(--shadow-glow)]">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Go unlimited with Filefox Pro</h2>
            <p className="mt-3 opacity-90 max-w-xl mx-auto">Larger files, priority queue, and batch conversions. From $5/mo.</p>
            <button className="mt-7 inline-flex items-center gap-2 rounded-full bg-background text-foreground px-6 py-3 text-sm font-semibold hover:scale-105 transition-transform shadow-lg">
              See pricing
            </button>
          </div>
        </section>

        {/* Bottom ad */}
        <div className="container mx-auto px-4 md:px-6 pb-8">
          <AdSlot label="Bottom advertisement" height="h-28" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
