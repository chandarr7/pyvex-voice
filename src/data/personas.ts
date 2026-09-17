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
        sampleScript: 'Hello, I am a clinical intake assistant. I can take down what you are experiencing so a clinician can review it. Could you start by telling me what has been going on?',
        pitch: 1.05,
        rate: 0.98,
      },
      male: {
        gender: 'male',
        name: 'Dr. Marcus (Antoni)',
        elevenLabsId: 'ErXwobaYiN019PkySvjV',
        tone: 'Warm, authoritative, reassuring cadence',
        sampleScript: 'Good evening, this is the patient care line. I can note down how you have been feeling since your last visit. How are you doing this evening?',
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
        sampleScript: 'Good afternoon. I can take down the details of a transaction you do not recognise and pass it to our security team. Which charge would you like to report?',
        pitch: 1.02,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Julian (Adam)',
        elevenLabsId: 'pNInz6obpgDQGcFmaJgB',
        tone: 'Deep, trustworthy, corporate executive resonance',
        sampleScript: 'Welcome back. I can talk through how your account settings and reporting options work, and take down anything you would like an advisor to follow up on.',
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
        sampleScript: 'Welcome to Pyvex Estates. I can find out what you are looking for and arrange for one of our agents to follow up with properties that fit. What sort of home do you have in mind?',
        pitch: 1.04,
        rate: 1.02,
      },
      male: {
        gender: 'male',
        name: 'Harrison (Josh)',
        elevenLabsId: 'TxGEqnHWrfWFTfGW9XjX',
        tone: 'Dynamic, polished, charismatic advisory',
        sampleScript: 'Hello, I am with Pyvex Estates. Tell me your area, budget and timeline, and I will make sure the right agent gets in touch with what is available.',
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
        sampleScript: 'Unit four zero two, this is Pyvex Fleet Dispatch. Tell me what your system is showing for the pass and I will help you work through the alternatives.',
        pitch: 1.03,
        rate: 1.04,
      },
      male: {
        gender: 'male',
        name: 'Cole (Sam)',
        elevenLabsId: 'yoZ06aMxZJJ28mfd3POQ',
        tone: 'Dependable, steady, resonant operator voice',
        sampleScript: 'Copy that, driver. I can note your arrival details and raise anything you need with the receiving team at the yard.',
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
        sampleScript: 'Hi there. I can take down the details of your order enquiry and pass it to a colleague who can look it up. What can I help you with today?',
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
