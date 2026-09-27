import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/projects", label: "Nos Projets" },
  { href: "/about", label: "À Propos" },
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-[#0D7C66] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-[#1A1A2E] leading-tight">Amanah</span>
              <span className="text-xs text-[#0D7C66] font-semibold -mt-1">GIVING</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.href
                    ? "text-[#0D7C66] bg-[#E8F5F0]"
                    : "text-[#374151] hover:text-[#0D7C66] hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-[#374151] hover:text-[#0D7C66] font-medium">
                    <User className="w-4 h-4 mr-2" />
                    {displayName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">{displayName}</p>
                    <p className="text-xs text-[#6B7280] truncate">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/admin">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Administration
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login" state={{ from: location.pathname }}>
                <Button variant="ghost" className="text-[#374151] hover:text-[#0D7C66] font-medium">
                  <LogIn className="w-4 h-4 mr-2" />
                  Se connecter
                </Button>
              </Link>
            )}
            <Link to="/donate">
              <Button className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg px-6 font-semibold shadow-md hover:shadow-lg transition-all">
                <Heart className="w-4 h-4 mr-2" />
                Faire un Don
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6 text-[#1A1A2E]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-white p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#0D7C66] rounded-lg flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="font-bold text-[#1A1A2E]">Amanah Giving</span>
                  </div>
                </div>
                <div className="flex flex-col p-4 gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setOpen(false)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        location.pathname === link.href
                          ? "text-[#0D7C66] bg-[#E8F5F0]"
                          : "text-[#374151] hover:bg-gray-50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <div className="mt-auto p-4 border-t space-y-2">
                  {user ? (
                    <>
                      <div className="px-1 pb-1">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{displayName}</p>
                        <p className="text-xs text-[#6B7280] truncate">{user.email}</p>
                      </div>
                      {user.role === "admin" && (
                        <Link to="/admin" onClick={() => setOpen(false)} className="block">
                          <Button variant="outline" className="w-full rounded-lg">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Administration
                          </Button>
                        </Link>
                      )}
                      <Button variant="outline" className="w-full rounded-lg" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Se déconnecter
                      </Button>
                    </>
                  ) : (
                    <Link to="/login" state={{ from: location.pathname }} onClick={() => setOpen(false)} className="block">
                      <Button variant="outline" className="w-full rounded-lg">
                        <LogIn className="w-4 h-4 mr-2" />
                        Se connecter
                      </Button>
                    </Link>
                  )}
                  <Link to="/donate" onClick={() => setOpen(false)} className="block">
                    <Button className="w-full bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg font-semibold">
                      <Heart className="w-4 h-4 mr-2" />
                      Faire un Don
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}