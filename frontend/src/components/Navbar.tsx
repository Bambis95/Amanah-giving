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
import { Menu, Heart, LogIn, LogOut, User, UserRound, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { isStaff } from "@/lib/roles";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Dictionary, useI18n } from "@/i18n";

const navLinks = (t: Dictionary["nav"]) => [
  { href: "/", label: t.home },
  { href: "/projects", label: t.campaigns },
  { href: "/about", label: t.about },
  // Short labels keep the desktop bar on one line; the drawer shows the full ones
  { href: "/adherer", label: t.join, short: t.joinShort },
  { href: "/proposer", label: t.propose, short: t.proposeShort },
  { href: "/contact", label: t.contact },
];

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const t = useI18n().t.nav;
  const links = navLinks(t);
  const displayName = user?.name || user?.email.split("@")[0];

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.success(t.loggedOut);
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
          <div className="hidden items-center gap-0.5 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground"
                )}
              >
                {"short" in link ? link.short : link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />

            <div className="hidden items-center gap-2 lg:flex">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="max-w-[12rem] px-3 font-medium text-foreground/80" aria-label={`Compte : ${displayName}`}>
                      <User className="h-4 w-4 shrink-0 xl:mr-2" />
                      {/* Name only on wide screens so the bar fits at 1024px */}
                      <span className="hidden truncate xl:inline">{displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/mon-espace">
                        <UserRound className="mr-2 h-4 w-4" />
                        {t.mySpace}
                      </Link>
                    </DropdownMenuItem>
                    {isStaff(user.role) && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/admin">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {t.dashboard}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="ghost" className="px-3 font-medium text-foreground/80">
                  <Link to="/login" state={{ from: location.pathname }} aria-label={t.login} title={t.login}>
                    <LogIn className="h-4 w-4 xl:mr-2" />
                    <span className="hidden xl:inline">{t.login}</span>
                  </Link>
                </Button>
              )}
            </div>

            {/* The main action stays reachable from 640px, even when the links are in the drawer */}
            <Button asChild className="hidden font-semibold shadow-sm sm:inline-flex">
              <Link to="/donate">
                <Heart className="mr-2 h-4 w-4" />
                {t.donate}
              </Link>
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden" aria-label={t.openMenu}>
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col bg-background p-0">
                <SheetTitle className="border-b border-border p-4">
                  <Logo size="sm" />
                </SheetTitle>
                <nav aria-label="Menu mobile" className="flex flex-col gap-1 p-4">
                  {links.map((link) => (
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
                      <Button asChild variant="outline" className="h-11 w-full">
                        <Link to="/mon-espace" onClick={() => setOpen(false)}>
                          <UserRound className="mr-2 h-4 w-4" />
                          {t.mySpace}
                        </Link>
                      </Button>
                      {isStaff(user.role) && (
                        <Button asChild variant="outline" className="h-11 w-full">
                          <Link to="/admin" onClick={() => setOpen(false)}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            {t.dashboard}
                          </Link>
                        </Button>
                      )}
                      <Button variant="outline" className="h-11 w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        {t.logout}
                      </Button>
                    </>
                  ) : (
                    <Button asChild variant="outline" className="h-11 w-full">
                      <Link to="/login" state={{ from: location.pathname }} onClick={() => setOpen(false)}>
                        <LogIn className="mr-2 h-4 w-4" />
                        {t.login}
                      </Link>
                    </Button>
                  )}
                  <Button asChild className="h-11 w-full font-semibold">
                    <Link to="/donate" onClick={() => setOpen(false)}>
                      <Heart className="mr-2 h-4 w-4" />
                      {t.donate}
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
