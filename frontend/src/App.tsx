import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './i18n';
import { ThemeProvider } from 'next-themes';
import ScrollToTop from './components/ScrollToTop';
import SessionTimeout from './components/SessionTimeout';

// The home page ships with the first download; every other page loads when first visited
const Donate = lazy(() => import('./pages/Donate'));
const Projects = lazy(() => import('./pages/Projects'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation'));
const Account = lazy(() => import('./pages/Account'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Join = lazy(() => import('./pages/Join'));
const Partners = lazy(() => import('./pages/Partners'));
const Transparency = lazy(() => import('./pages/Transparency'));
const Stand = lazy(() => import('./pages/Stand'));
const Poster = lazy(() => import('./pages/Poster'));
const Membership = lazy(() => import('./pages/Membership'));
const MembershipPrint = lazy(() => import('./pages/MembershipPrint'));

const queryClient = new QueryClient();

// Shown for the instant a page's code is being fetched
const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  // Theme: saved choice, else system preference, else light; applied as the "dark" class
  // on <html> (the inline script in index.html does the same before first paint).
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    storageKey="amanah-theme"
    disableTransitionOnChange
  >
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
      <I18nProvider>
      <BrowserRouter>
        <ScrollToTop />
        <SessionTimeout />
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invitation" element={<AcceptInvitation />} />
          <Route path="/mon-espace" element={<Account />} />
          <Route path="/desabonnement" element={<Unsubscribe />} />
          <Route path="/" element={<Index />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/adherer" element={<Membership />} />
          <Route path="/adherer/imprimer" element={<MembershipPrint />} />
          <Route path="/proposer" element={<Join />} />
          {/* Former address of the form, kept so older links still work */}
          <Route path="/rejoindre" element={<Join />} />
          <Route path="/partenaires" element={<Partners />} />
          <Route path="/transparence" element={<Transparency />} />
          {/* Event material: stand screen and printable poster (not linked from the menus) */}
          <Route path="/stand" element={<Stand />} />
          <Route path="/affiche" element={<Poster />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="/conditions" element={<Terms />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </I18nProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;