import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroCarousel } from './components/HeroCarousel';
import { FeatureShowcase } from './components/FeatureShowcase';
import { SolutionsGrid } from './components/SolutionsGrid';
import { GeminiChatSection } from './components/GeminiChatSection';
import { GeminiFloatingChat } from './components/GeminiFloatingChat';
import { PricingSection } from './components/PricingSection';
import { Footer } from './components/Footer';
import { LiveStudioModal } from './components/LiveStudioModal';
import { DemoModal } from './components/DemoModal';
import { AuthModal } from './components/AuthModal';
import { AuthProvider } from './context/AuthContext';
import { PYVEX_PERSONAS } from './data/personas';

export function AppContent() {
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activePersonaId, setActivePersonaId] = useState(PYVEX_PERSONAS[0].id);

  const handleOpenStudio = () => {
    setIsStudioOpen(true);
  };

  const handleOpenPricing = () => {
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenDocs = () => {
    const el = document.getElementById('architecture');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  // Hero persona to chat role, and to the server-side conversation flow.
  const GEMINI_ROLE_BY_PERSONA: Record<string, string> = {
    'healthcare-triage': 'clinical_intake',
    'fintech-wealth': 'account_security',
    'real-estate-luxury': 'property_enquiry',
    'logistics-dispatch': 'logistics_coordinator',
  };
  const VOICE_FLOW_BY_PERSONA: Record<string, string> = {
    'healthcare-triage': 'clinical_intake',
    'fintech-wealth': 'account_security',
    'real-estate-luxury': 'real_estate',
  };
  const geminiRoleFromPersona = GEMINI_ROLE_BY_PERSONA[activePersonaId] ?? 'customer_support';

  return (
    <div className="min-h-screen flex flex-col bg-[#08090B] text-[#F4F2F8] selection:bg-[#7047FF]/30 selection:text-[#F4F2F8] antialiased">
      {/* Sticky Header Navigation */}
      <Navbar
        onOpenStudio={handleOpenStudio}
        onOpenPricing={handleOpenPricing}
        onOpenDocs={handleOpenDocs}
        onOpenAuth={handleOpenAuth}
      />

      <main className="flex-1 flex flex-col">
        {/* Core Hero Section with 3D Carousel & Voice Customization Bar */}
        <HeroCarousel
          onOpenStudio={handleOpenStudio}
          onBookDemo={() => setIsDemoModalOpen(true)}
          onSelectPersona={(id) => setActivePersonaId(id)}
        />

        {/* Feature Showcase & Latency Benchmark Matrix */}
        <FeatureShowcase onOpenStudio={handleOpenStudio} />

        {/* Industry Solutions Matrix */}
        <SolutionsGrid
          activePersonaId={activePersonaId}
          onSelectPersona={(id) => setActivePersonaId(id)}
          onOpenStudio={handleOpenStudio}
        />

        {/* Dedicated Gemini Multi-Turn Conversational Agent Section */}
        <GeminiChatSection initialRole={geminiRoleFromPersona} />

        {/* Transparent Pricing Section */}
        <PricingSection
          onOpenStudio={handleOpenStudio}
          onBookDemo={() => setIsDemoModalOpen(true)}
        />
      </main>

      {/* Floating Quick Chat Widget for Gemini Conversational Agent */}
      <GeminiFloatingChat />

      {/* Luxury Footer */}
      <Footer />

      {/* Interactive Live Voice Studio Modal Sandbox */}
      <LiveStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onOpenAuth={handleOpenAuth}
        initialFlowId={VOICE_FLOW_BY_PERSONA[activePersonaId] ?? 'customer_support'}
      />

      {/* Enterprise Briefing / Book a Demo Modal */}
      <DemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />

      {/* Cloud Database & Account Login Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSelectAgent={() => {
          setIsStudioOpen(true);
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

