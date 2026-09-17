export interface PersonaVoice {
  gender: 'male' | 'female';
  name: string;
  elevenLabsId: string;
  tone: string;
  sampleScript: string;
  pitch: number;
  rate: number;
}

export interface Persona {
  id: string;
  category: string;
  roleTitle: string;
  headline: string;
  subheadline: string;
  statBadge: string;
  voiceProvider: 'ElevenLabs' | 'Cartesia' | string;
  voiceModel: string;
  metrics: {
    latency: string;
    accuracy: string;
    resolution: string;
  };
  accentColor: string;
  voices: {
    female: PersonaVoice;
    male: PersonaVoice;
  };
  features: string[];
}

export const PYVEX_PERSONAS: Persona[] = [
  {
    id: 'enterprise-sdr',
    category: 'ENTERPRISE B2B',
    roleTitle: 'Inbound Sales SDR Agent',
    headline: 'The Real-Time Voice Infrastructure for Enterprise AI.',
    subheadline: 'Hyper-realistic voice agents that adapt tone, voice, and industry context in sub-300ms.',
    statBadge: 'PYVEX ENGINE V2.5 LIVE',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '<300ms Latency',
      accuracy: '1,500,000+ Sessions',
      resolution: '99.99% Uptime',
    },
    accentColor: '#9655FF',
    features: ['Real-time qualification', 'CRM & HubSpot live sync', 'Dynamic objection handling'],
    voices: {
      male: {
        gender: 'male',
        name: 'Alex (Inbound SDR)',
        elevenLabsId: 'ErXwobaYiN019PkySvjV',
        tone: 'Persuasive, energetic, professional enterprise sales demeanor',
        sampleScript: 'Hi there, thanks for reaching out to Pyvex. I understand your team is evaluating real-time conversational voice infrastructure for your enterprise stack. What volume of concurrent voice sessions are you planning for this quarter?',
        pitch: 1.0,
        rate: 1.02,
      },
      female: {
        gender: 'female',
        name: 'Sarah (Inbound SDR)',
        elevenLabsId: '21m00Tcm4TlvDq8ikWAM',
        tone: 'Articulate, consultative, polished executive cadence',
        sampleScript: 'Hello, this is Sarah from Pyvex Enterprise Solutions. I can walk you through our sub-300ms acoustic pipeline, SIP trunking integrations, and custom voice persona deployments.',
        pitch: 1.02,
        rate: 1.0,
      },
    },
  },
  {
    id: 'healthcare-triage',
    category: 'Healthcare & Clinical',
    roleTitle: 'Clinical Triage & Patient Intake',
    headline: 'Autonomous Patient Intake with Clinical Empathy',
    subheadline: 'HIPAA-compliant vocal triage, intelligent EHR symptom routing, and instant appointment booking with ultra-low latency response.',
    statBadge: 'HIPAA Certified • HL7 FHIR Compliant',
    voiceProvider: 'Cartesia',
    voiceModel: 'Sonic-2',
    metrics: {
      latency: '240ms',
      accuracy: '99.4%',
      resolution: '88% unassisted',
    },
    accentColor: '#38bdf8',
    features: ['Real-time symptom analysis', 'Biometric voice verification', 'Automated doctor calendar sync'],
    voices: {
      female: {
        gender: 'female',
        name: 'Dr. Evelyn (Rachel)',
        elevenLabsId: '21m00Tcm4TlvDq8ikWAM',
        tone: 'Calm, empathetic, precise clinical tone',
        sampleScript: 'Hello! I am your clinical intake assistant at Pyvex Health. I can triage your symptoms, assess severity, and schedule your specialist consultation right away.',
        pitch: 1.05,
        rate: 0.98,
      },
      male: {
        gender: 'male',
        name: 'Dr. Marcus (Antoni)',
        elevenLabsId: 'ErXwobaYiN019PkySvjV',
        tone: 'Warm, authoritative, reassuring cadence',
        sampleScript: 'Good day. This is Dr. Marcus with Pyvex Patient Care. I am reviewing your recent chart updates. How are you feeling this evening?',
        pitch: 0.95,
        rate: 0.97,
      },
    },
  },
  {
    id: 'fintech-wealth',
    category: 'FinTech & Banking',
    roleTitle: 'Wealth Advisory & Fraud Verification',
    headline: 'Institutional Security Meets Real-Time Vocal Banking',
    subheadline: 'Protect high-value accounts with continuous biometric voice verification, explain portfolio yields, and execute authorized wire transfers.',
    statBadge: 'SOC-2 Type II • PCI-DSS Level 1',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Flash v2.5',
    metrics: {
      latency: '220ms',
      accuracy: '99.8%',
      resolution: '92% deflection',
    },
    accentColor: '#fbbf24',
    features: ['Continuous voice biometrics', 'Real-time AML flag handling', 'Automated wire dispatch'],
    voices: {
      female: {
        gender: 'female',
        name: 'Claire (Bella)',
        elevenLabsId: 'EXAVITQu4vr4xnSDxMaL',
        tone: 'Sophisticated, poised, articulate finance voice',
        sampleScript: 'Good afternoon. I detected an unusual debit of four hundred twenty dollars in Zurich. Shall I verify this transaction with your digital token, or immediately lock the card?',
        pitch: 1.02,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Julian (Adam)',
        elevenLabsId: 'pNInz6obpgDQGcFmaJgB',
        tone: 'Deep, trustworthy, corporate executive resonance',
        sampleScript: 'Welcome back. Your private portfolio gained one point four percent today, led by semiconductor index rebalancing. Would you like a detailed breakdown of your quarterly dividends?',
        pitch: 0.92,
        rate: 0.98,
      },
    },
  },
  {
    id: 'real-estate-luxury',
    category: 'Luxury Real Estate',
    roleTitle: 'High-Net-Worth Property Concierge',
    headline: 'Elite Conversational Concierge for Ultra-Luxury Real Estate',
    subheadline: 'Qualify multi-million dollar buyers, provide architectural specs over natural phone dialogue, and coordinate private twilight showings.',
    statBadge: 'HNW Qualified • 24/7 Global Coverage',
    voiceProvider: 'Cartesia',
    voiceModel: 'Sonic Multi',
    metrics: {
      latency: '250ms',
      accuracy: '98.9%',
      resolution: '3.4x lead conversion',
    },
    accentColor: '#e2b36b',
    features: ['Interactive architectural walkthroughs', 'Escrow pre-qualification', 'Calendar booking via SMS/SIP'],
    voices: {
      female: {
        gender: 'female',
        name: 'Victoria (Nicole)',
        elevenLabsId: 'piTKgcLEGmPE4e6mEKli',
        tone: 'Warm, refined, persuasive hospitality cadence',
        sampleScript: 'Welcome to the Penthouse Collection at Tribeca Tower. The residence features twelve-foot ceilings and private elevator access. Would you like to reserve a private viewing for this Thursday evening?',
        pitch: 1.04,
        rate: 1.02,
      },
      male: {
        gender: 'male',
        name: 'Harrison (Josh)',
        elevenLabsId: 'TxGEqnHWrfWFTfGW9XjX',
        tone: 'Dynamic, polished, charismatic advisory',
        sampleScript: 'Hello! I am Harrison representing Pyvex Estates. We just listed an off-market modernist villa in Aspen with heated lap pools and guest lodge. Shall I send the private prospectus to your email?',
        pitch: 0.96,
        rate: 1.0,
      },
    },
  },
  {
    id: 'logistics-dispatch',
    category: 'Logistics & Fleet',
    roleTitle: 'Autonomous Driver Dispatch & Routing',
    headline: 'Hands-Free Cellular Dispatch for Heavy Freight Fleets',
    subheadline: 'Keep commercial drivers focused on the road with voice-first telematics, adverse weather reroutes, and instant dock reservation checks.',
    statBadge: 'DOT Compliant • Telephony SIP Native',
    voiceProvider: 'Cartesia',
    voiceModel: 'Sonic Fast',
    metrics: {
      latency: '195ms',
      accuracy: '99.6%',
      resolution: '99.99% uptime',
    },
    accentColor: '#34d399',
    features: ['Ambient truck cab noise suppression', 'Instant GPS geofence alerts', 'Direct ELD hours logging'],
    voices: {
      female: {
        gender: 'female',
        name: 'Serena (Elli)',
        elevenLabsId: 'MF3mGyEYCl7XYWbV9V6O',
        tone: 'Crisp, attentive, clear aviation/dispatch cadence',
        sampleScript: 'Unit 402, this is Pyvex Fleet Dispatch. Interstate 80 is closed near the pass due to ice. I have calculated an alternate route via Highway 6 that adds only fifteen minutes to your dock window.',
        pitch: 1.03,
        rate: 1.04,
      },
      male: {
        gender: 'male',
        name: 'Cole (Sam)',
        elevenLabsId: 'yoZ06aMxZJJ28mfd3POQ',
        tone: 'Dependable, steady, resonant operator voice',
        sampleScript: 'Copy that, driver. Your bill of lading has been pre-cleared at Gate 4 in Chicago. Pull straight through to Bay 12 for priority unloading.',
        pitch: 0.93,
        rate: 1.02,
      },
    },
  },
  {
    id: 'ecommerce-retail',
    category: 'Retail & Commerce',
    roleTitle: 'White-Glove Customer Experience',
    headline: 'Real-Time Conversational Commerce & Order Resolution',
    subheadline: 'Instantly resolve return authorizations, check cross-border parcel delivery statuses, and upsell complementary luxury accessories in natural dialogue.',
    statBadge: 'Shopify Plus Native • Stripe Integrated',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '210ms',
      accuracy: '99.2%',
      resolution: '94% first-contact CSAT',
    },
    accentColor: '#c084fc',
    features: ['Instant payment tokenization', 'Multilingual auto-detection', 'Return QR generation over SMS'],
    voices: {
      female: {
        gender: 'female',
        name: 'Aria (Domi)',
        elevenLabsId: 'AZnzlk1XvdvUeBnXmlld',
        tone: 'Friendly, upbeat, modern concierge tone',
        sampleScript: 'Hi there! Your bespoke Italian leather luggage was dispatched this morning and will arrive by tomorrow afternoon. Would you like me to text you the courier tracking link right now?',
        pitch: 1.08,
        rate: 1.03,
      },
      male: {
        gender: 'male',
        name: 'Lucas (Arnold)',
        elevenLabsId: 'VR6AewLTigWG4xSOukaG',
        tone: 'Attentive, courteous, helpful retail specialist',
        sampleScript: 'Hello! I can process your exchange for the charcoal wool overcoat in size large immediately. I will email the pre-paid return slip while we are on the line.',
        pitch: 0.94,
        rate: 0.99,
      },
    },
  },
];
