import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import Donate from './pages/Donate';
import Projects from './pages/Projects';
import About from './pages/About';
import Contact from './pages/Contact';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Admin from './pages/Admin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitation from './pages/AcceptInvitation';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Join from './pages/Join';
import Partners from './pages/Partners';
import Transparency from './pages/Transparency';
import Stand from './pages/Stand';
import Poster from './pages/Poster';
import Membership from './pages/Membership';
import MembershipPrint from './pages/MembershipPrint';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from 'next-themes';
import ScrollToTop from './components/ScrollToTop';
import SessionTimeout from './components/SessionTimeout';

const queryClient = new QueryClient();

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
      <BrowserRouter>
        <ScrollToTop />
        <SessionTimeout />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invitation" element={<AcceptInvitation />} />
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
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;