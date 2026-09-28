import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Heart, LogIn, LogOut, User, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/projects", label: "Campagnes" },
  { href: "/about", label: "À Propos" },
  { href: "/proposer", label: "Proposer une Campagne" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const displayName = user?.name || user?.email.split("@")[0];

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.success("Vous êtes déconnecté");
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <nav aria-label="Navigation principale" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="rounded-lg transition-opacity hover:opacity-90" aria-label={`${BRAND_NAME}, accueil`}>
            <Logo />
          </Link>

          {/* Desktop links (lg+: below, everything moves to the drawer so nothing overflows on tablets) */}
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />

            <div className="hidden items-center gap-2 lg:flex">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="max-w-[12rem] font-medium text-foreground/80">
                      <User className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/admin">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Administration
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Se déconnecter
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="ghost" className="font-medium text-foreground/80">
                  <Link to="/login" state={{ from: location.pathname }}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Se connecter
                  </Link>
                </Button>
              )}
            </div>

            {/* The main action stays reachable from 640px, even when the links are in the drawer */}
            <Button asChild className="hidden font-semibold shadow-sm sm:inline-flex">
              <Link to="/donate">
                <Heart className="mr-2 h-4 w-4" />
                Faire un Don
              </Link>
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden" aria-label="Ouvrir le menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col bg-background p-0">
                <SheetTitle className="border-b border-border p-4">
                  <Logo size="sm" />
                </SheetTitle>
                <nav aria-label="Menu mobile" className="flex flex-col gap-1 p-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "rounded-lg px-4 py-3 text-base font-medium transition-colors",
                        isActive(link.href)
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto space-y-2 border-t border-border p-4">
                  {user ? (
                    <>
                      <div className="px-1 pb-1">
                        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {user.role === "admin" && (
                        <Button asChild variant="outline" className="h-11 w-full">
                          <Link to="/admin" onClick={() => setOpen(false)}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Administration
                          </Link>
                        </Button>
                      )}
                      <Button variant="outline" className="h-11 w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                      </Button>
                    </>
                  ) : (
                    <Button asChild variant="outline" className="h-11 w-full">
                      <Link to="/login" state={{ from: location.pathname }} onClick={() => setOpen(false)}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Se connecter
                      </Link>
                    </Button>
                  )}
                  <Button asChild className="h-11 w-full font-semibold">
                    <Link to="/donate" onClick={() => setOpen(false)}>
                      <Heart className="mr-2 h-4 w-4" />
                      Faire un Don
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
