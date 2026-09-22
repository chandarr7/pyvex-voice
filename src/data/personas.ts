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
  voiceProvider: 'ElevenLabs';
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
        name: 'Charlie (Inbound SDR)',
        elevenLabsId: 'IKne3meq5aSn9XLyUdCD',
        tone: 'Persuasive, energetic, professional enterprise sales demeanor',
        sampleScript: 'Hi there, thanks for reaching out to Pyvex. I understand your team is evaluating real-time conversational voice infrastructure for your enterprise stack. What volume of concurrent voice sessions are you planning for this quarter?',
        pitch: 1.0,
        rate: 1.02,
      },
      female: {
        gender: 'female',
        name: 'Freya (Inbound SDR)',
        elevenLabsId: 'jsCqWAovK2LkecY7zXl4',
        tone: 'Radiant, charmingly sweet, consultative cadence with an articulate, warm acoustic smile',
        sampleScript: "Hi there! I'm Freya from Pyvex Enterprise Solutions. I'm so excited to connect with you! I can walk you through our sub-300ms acoustic pipeline, SIP trunking integrations, and custom voice deployments.",
        pitch: 1.12,
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
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
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
        name: 'Dr. Alice (Clinical Intake)',
        elevenLabsId: 'Xb7hH8MSUJpSbSDYk0k2',
        tone: 'Calm, empathetic, precise clinical tone',
        sampleScript: 'Hello! I am your clinical intake assistant at Pyvex Health. I can triage your symptoms, assess severity, and schedule your specialist consultation right away.',
        pitch: 1.05,
        rate: 0.98,
      },
      male: {
        gender: 'male',
        name: 'Dr. George (Physician Advisor)',
        elevenLabsId: 'JBFqnCBsd6RMkjVDRZzb',
        tone: 'Warm, authoritative, reassuring cadence',
        sampleScript: 'Good day. This is Dr. George with Pyvex Patient Care. I am reviewing your recent chart updates. How are you feeling this evening?',
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
    voiceModel: 'Turbo v2.5',
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
        name: 'Bella (Wealth Concierge)',
        elevenLabsId: 'hpp4J3VqNfWAUOO0d1Us',
        tone: 'Sophisticated, poised, articulate finance voice',
        sampleScript: 'Good afternoon. I detected an unusual debit of four hundred twenty dollars in Zurich. Shall I verify this transaction with your digital token, or immediately lock the card?',
        pitch: 1.02,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Eric (Institutional Advisor)',
        elevenLabsId: 'cjVigY5qzO86Huf0OWal',
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
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
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
        name: 'Sarah (Luxury Host)',
        elevenLabsId: 'EXAVITQu4vr4xnSDxMaL',
        tone: 'Warm, refined, persuasive hospitality cadence',
        sampleScript: 'Welcome to the Penthouse Collection at Tribeca Tower. The residence features twelve-foot ceilings and private elevator access. Would you like to reserve a private viewing for this Thursday evening?',
        pitch: 1.04,
        rate: 1.02,
      },
      male: {
        gender: 'male',
        name: 'Liam (Estates Advisor)',
        elevenLabsId: 'TX3LPaxmHKxFdv7VOQHJ',
        tone: 'Dynamic, polished, charismatic advisory',
        sampleScript: 'Hello! I am Liam representing Pyvex Estates. We just listed an off-market modernist villa in Aspen with heated lap pools and guest lodge. Shall I send the private prospectus to your email?',
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
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
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
        name: 'Jessica (Fleet Operations)',
        elevenLabsId: 'cgSgspJ2msm6clMCkdW9',
        tone: 'Crisp, attentive, clear aviation/dispatch cadence',
        sampleScript: 'Unit 402, this is Pyvex Fleet Dispatch. Interstate 80 is closed near the pass due to ice. I have calculated an alternate route via Highway 6 that adds only fifteen minutes to your dock window.',
        pitch: 1.03,
        rate: 1.04,
      },
      male: {
        gender: 'male',
        name: 'Roger (Fleet Controller)',
        elevenLabsId: 'CwhRBWXzGAHq8TQ4Fs17',
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
        name: 'Bella (Concierge)',
        elevenLabsId: 'hpp4J3VqNfWAUOO0d1Us',
        tone: 'Friendly, upbeat, modern concierge tone',
        sampleScript: 'Hi there! Your bespoke Italian leather luggage was dispatched this morning and will arrive by tomorrow afternoon. Would you like me to text you the courier tracking link right now?',
        pitch: 1.08,
        rate: 1.03,
      },
      male: {
        gender: 'male',
        name: 'Charlie (Retail Specialist)',
        elevenLabsId: 'IKne3meq5aSn9XLyUdCD',
        tone: 'Attentive, courteous, helpful retail specialist',
        sampleScript: 'Hello! I can process your exchange for the charcoal wool overcoat in size large immediately. I will email the pre-paid return slip while we are on the line.',
        pitch: 0.94,
        rate: 0.99,
      },
    },
  },
];

export interface SweetVoiceProfile {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  tone: string;
  pitch: number;
  rate: number;
  sampleScript: string;
  flag: string;
}

export const SWEET_FEMALE_VOICES: SweetVoiceProfile[] = [
  {
    id: 'jsCqWAovK2LkecY7zXl4',
    name: 'Freya',
    badge: 'Sweet Radiant',
    tagline: 'Bright, youthful, sparkling sweetness',
    description: 'Radiant, cheerful, and charmingly sweet cadence with a warm acoustic smile. Ideal for delightful concierge and friendly sales hospitality.',
    tone: 'Charming, radiant, playful sweet smile',
    pitch: 1.12,
    rate: 1.0,
    sampleScript: "Hi there! I'm Freya. I'm so excited to connect with you! Everything is running smoothly, and I'd love to assist you with whatever you need.",
    flag: '✨',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    badge: 'Sweet Velvet',
    tagline: 'Warm, velvet, soothing acoustic warmth',
    description: 'A comforting, velvety sweet tone that puts listeners at ease immediately. Exceptional for healthcare, caregiving, and gentle guidance.',
    tone: 'Soothing, gentle, sweet velvet acoustic warmth',
    pitch: 1.08,
    rate: 0.96,
    sampleScript: "Hello! I'm Lily. It is such a pleasure to speak with you today. Take your time, and let me know how I can help make things easier for you.",
    flag: '🌸',
  },
  {
    id: 'LcfcDJNigUd50AZSDxio',
    name: 'Emily',
    badge: 'Sweet Gentle',
    tagline: 'Soft-spoken, calm, tender intimacy',
    description: 'Tender, sweet, soft-spoken conversational tone with calm empathetic reassurance. Perfect for personal consultations and patient check-ins.',
    tone: 'Tender, calm, soft-spoken empathetic sweetness',
    pitch: 1.06,
    rate: 0.98,
    sampleScript: "Hello, this is Emily. I'm right here with you. Please feel free to share any details, and we'll take care of everything step by step.",
    flag: '🌷',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    badge: 'Sweet Melodic',
    tagline: 'Melodic, delicate, silky enunciation',
    description: 'Delicate, sweet, and melodic cadence with silky pronunciation. Perfect for luxury boutique concierges, narration, and VIP welcoming.',
    tone: 'Melodic, delicate, silky elegant sweetness',
    pitch: 1.10,
    rate: 0.95,
    sampleScript: "A very warm welcome to you. I'm Charlotte. It is an absolute delight to assist you today with the finest care and personalized attention.",
    flag: '🕊️',
  },
  {
    id: 'piTKgcLEGmPE4e6mEKli',
    name: 'Nicole',
    badge: 'Sweet Whisper-Soft',
    tagline: 'Whisper-soft, intimate, peaceful warmth',
    description: 'Velvety, intimate, and peacefully sweet whispery warmth designed for comforting interactions, mindful wellness, and bedtime calm.',
    tone: 'Velvety, peaceful, intimate whispery sweetness',
    pitch: 1.04,
    rate: 0.97,
    sampleScript: "Hi, I'm Nicole. Take a gentle breath. I'm here to listen, support you, and guide you through whenever you are ready.",
    flag: '🌙',
  },
];
