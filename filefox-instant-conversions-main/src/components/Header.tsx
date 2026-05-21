import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, UserCircle2 } from "lucide-react";
// removed unused Shield import
import { FoxLogo } from "./FoxLogo";
import { isAuthenticated, logoutUser, subscribeAuthChange } from "@/lib/auth";

export function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const authenticated = isAuthenticated();
    setLoggedIn(authenticated);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuthChange(() => {
      const authenticated = isAuthenticated();
      setLoggedIn(authenticated);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-user-menu]") && !target.closest("[data-user-button]")) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showMenu]);

  const handleLogout = () => {
    logoutUser();
    setLoggedIn(false);
    setShowMenu(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full glass">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <FoxLogo className="h-14 md:h-16.5 w-auto" />
          <span className="text-xl font-bold tracking-tight"></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="#converter" className="text-muted-foreground hover:text-foreground transition-colors">Converter</a>
          <a href="#tools" className="text-muted-foreground hover:text-foreground transition-colors">Tools</a>
          <Link to="/uploads" className="text-muted-foreground hover:text-foreground transition-colors">Últimas subidas</Link>
        </nav>

        {loggedIn ? (
          <div className="relative" data-user-menu>
            <button
              type="button"
              data-user-button
              onClick={() => setShowMenu((value) => !value)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:shadow-md"
            >
              <UserCircle2 className="h-6 w-6" />
            </button>

            {showMenu ? (
              <div className="absolute right-0 mt-3 w-72 min-w-[18rem] login-panel">
                <div className="menu-options">
                  <Link to="/dashboard" className="option-item">
                    <span>Panel</span>
                  </Link>
                  <Link to="/uploads" className="option-item">
                    <span>Perfil</span>
                  </Link>
                  <Link to="/settings" className="option-item">
                    <span>Configuración</span>
                  </Link>
                  <Link to="/login" className="option-item download-app">
                    <span>Cerrar Sesión</span>
                    <ArrowRight className="option-icon" />
                  </Link>
                </div>
                <div className="login-footer">
                  <button type="button" className="footer-link">Política de Privacidad</button>
                  <button type="button" className="footer-link">Términos</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            <span>Iniciar sesión</span>
          </Link>
        )}
      </div>
    </header>
  );
}
