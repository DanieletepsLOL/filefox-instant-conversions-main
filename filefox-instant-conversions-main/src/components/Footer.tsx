import { Github, Twitter } from "lucide-react";
import { FoxLogo } from "./FoxLogo";

export function Footer() {
  return (
    <footer className="border-t bg-card/50 mt-20">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <FoxLogo className="h-8 w-8" />
              <span className="text-lg font-bold">Filefox</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Fast, secure and private file conversion for over 1000 formats. Built for the modern web.
            </p>
            <div className="mt-4 flex gap-3">
              {[Twitter, Github].map((Icon, i) => (
                <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent hover:text-accent-foreground transition-colors" aria-label="social">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">About</a></li>
              <li><a href="#" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/privacy" className="hover:text-foreground">
                  Privacy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-foreground">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 Filefox by Brevia. All rights reserved.</p>
          <p>Made with care for creators and teams.</p>
        </div>
      </div>
    </footer>
  );
}
