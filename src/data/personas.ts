export interface PersonaVoice {
  gender: 'male' | 'female';
  name: string;
  elevenLabsId: string;
  previewUrl?: string;
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
    subheadline: 'Hyper-realistic ElevenLabs voice agents that adapt tone, voice, and industry context in sub-300ms.',
    statBadge: 'ELEVENLABS TURBO V2.5 LIVE',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '<140ms Latency',
      accuracy: '1,500,000+ Sessions',
      resolution: '99.99% Uptime',
    },
    accentColor: '#9655FF',
    features: ['Real-time qualification', 'CRM & HubSpot live sync', 'Dynamic objection handling'],
    voices: {
      female: {
        gender: 'female',
        name: 'Sarah (Mature & Reassuring)',
        elevenLabsId: 'EXAVITQu4vr4xnSDxMaL',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3',
        tone: 'Articulate, consultative, polished executive cadence',
        sampleScript: 'Hello, this is Sarah from Pyvex Enterprise Solutions powered by ElevenLabs. I can walk you through our sub-300ms acoustic pipeline, SIP trunking integrations, and custom voice persona deployments.',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Adam (Dominant & Firm)',
        elevenLabsId: 'pNInz6obpgDQGcFmaJgB',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3',
        tone: 'Persuasive, energetic, professional enterprise sales demeanor',
        sampleScript: 'Hi there, thanks for reaching out to Pyvex. I understand your team is evaluating real-time conversational voice infrastructure for your enterprise stack. What volume of concurrent voice sessions are you planning for this quarter?',
        pitch: 1.0,
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
    statBadge: 'HIPAA Certified • ElevenLabs Clinical',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '135ms',
      accuracy: '99.4%',
      resolution: '88% unassisted',
    },
    accentColor: '#38bdf8',
    features: ['Real-time symptom analysis', 'Biometric voice verification', 'Automated doctor calendar sync'],
    voices: {
      female: {
        gender: 'female',
        name: 'Matilda (Professional & Empathetic)',
        elevenLabsId: 'XrExE9yKIg1WjnnlVkGX',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
        tone: 'Calm, empathetic, precise clinical tone',
        sampleScript: 'Hello! I am your clinical intake assistant at Pyvex Health. I can triage your symptoms, assess severity, and schedule your specialist consultation right away.',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Brian (Deep & Comforting)',
        elevenLabsId: 'nPczCjzI2devNBz1zQrb',
        previewUrl: 'https://api.us.elevenlabs.io/v1/voices/nPczCjzI2devNBz1zQrb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIyZGQzZTcyYy00ZmQzLTQyZjEtOTNlYS1hYmM1ZDRlNWFhMWQubXAzIiwidGltZXN0YW1wIjoxNzg5ODg3NjAwMDAwMDAwfQ%3D%3D',
        tone: 'Warm, authoritative, reassuring cadence',
        sampleScript: 'Good day. This is Brian with Pyvex Patient Care. I am reviewing your recent chart updates. How are you feeling this evening?',
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
  {
    id: 'fintech-wealth',
    category: 'FinTech & Banking',
    roleTitle: 'Wealth Advisory & Fraud Verification',
    headline: 'Institutional Security Meets Real-Time Vocal Banking',
    subheadline: 'Protect high-value accounts with continuous biometric voice verification, explain portfolio yields, and execute authorized wire transfers.',
    statBadge: 'SOC-2 Type II • ElevenLabs Verified',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Flash v2.5',
    metrics: {
      latency: '110ms',
      accuracy: '99.8%',
      resolution: '92% deflection',
    },
    accentColor: '#fbbf24',
    features: ['Continuous voice biometrics', 'Real-time AML flag handling', 'Automated wire dispatch'],
    voices: {
      female: {
        gender: 'female',
        name: 'Bella (Professional & Warm)',
        elevenLabsId: 'hpp4J3VqNfWAUOO0d1Us',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3',
        tone: 'Sophisticated, poised, articulate finance voice',
        sampleScript: 'Good afternoon. I detected an unusual debit of four hundred twenty dollars in Zurich. Shall I verify this transaction with your digital token, or immediately lock the card?',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Eric (Smooth & Trustworthy)',
        elevenLabsId: 'cjVigY5qzO86Huf0OWal',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3',
        tone: 'Deep, trustworthy, corporate executive resonance',
        sampleScript: 'Welcome back. Your private portfolio gained one point four percent today, led by semiconductor index rebalancing. Would you like a detailed breakdown of your quarterly dividends?',
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
  {
    id: 'real-estate-luxury',
    category: 'Luxury Real Estate',
    roleTitle: 'High-Net-Worth Property Concierge',
    headline: 'Elite Conversational Concierge for Ultra-Luxury Real Estate',
    subheadline: 'Qualify multi-million dollar buyers, provide architectural specs over natural phone dialogue, and coordinate private twilight showings.',
    statBadge: 'HNW Qualified • ElevenLabs Ultra',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '140ms',
      accuracy: '98.9%',
      resolution: '3.4x lead conversion',
    },
    accentColor: '#e2b36b',
    features: ['Interactive architectural walkthroughs', 'Escrow pre-qualification', 'Calendar booking via SMS/SIP'],
    voices: {
      female: {
        gender: 'female',
        name: 'Lily (Velvety & Elegant)',
        elevenLabsId: 'pFZP5JQG7iQjIQuC4Bku',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3',
        tone: 'Warm, refined, persuasive hospitality cadence',
        sampleScript: 'Welcome to the Penthouse Collection at Tribeca Tower. The residence features twelve-foot ceilings and private elevator access. Would you like to reserve a private viewing for this Thursday evening?',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Roger (Laid-Back & Resonant)',
        elevenLabsId: 'CwhRBWXzGAHq8TQ4Fs17',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3',
        tone: 'Dynamic, polished, charismatic advisory',
        sampleScript: 'Hello! I am Roger representing Pyvex Estates. We just listed an off-market modernist villa in Aspen with heated lap pools and guest lodge. Shall I send the private prospectus to your email?',
        pitch: 1.0,
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
    statBadge: 'DOT Compliant • ElevenLabs Telephony',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '120ms',
      accuracy: '99.6%',
      resolution: '99.99% uptime',
    },
    accentColor: '#34d399',
    features: ['Ambient truck cab noise suppression', 'Instant GPS geofence alerts', 'Direct ELD hours logging'],
    voices: {
      female: {
        gender: 'female',
        name: 'Alice (Clear & Engaging)',
        elevenLabsId: 'Xb7hH8MSUJpSbSDYk0k2',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3',
        tone: 'Crisp, attentive, clear aviation/dispatch cadence',
        sampleScript: 'Unit 402, this is Pyvex Fleet Dispatch. Interstate 80 is closed near the pass due to ice. I have calculated an alternate route via Highway 6 that adds only fifteen minutes to your dock window.',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Bill (Wise & Resonant)',
        elevenLabsId: 'pqHfZKP75CvOlQylNhV4',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3',
        tone: 'Dependable, steady, resonant operator voice',
        sampleScript: 'Copy that, driver. Your bill of lading has been pre-cleared at Gate 4 in Chicago. Pull straight through to Bay 12 for priority unloading.',
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
  {
    id: 'ecommerce-retail',
    category: 'Retail & Commerce',
    roleTitle: 'White-Glove Customer Experience',
    headline: 'Real-Time Conversational Commerce & Order Resolution',
    subheadline: 'Instantly resolve return authorizations, check cross-border parcel delivery statuses, and upsell complementary luxury accessories in natural dialogue.',
    statBadge: 'Shopify Plus Native • ElevenLabs Concierge',
    voiceProvider: 'ElevenLabs',
    voiceModel: 'Turbo v2.5',
    metrics: {
      latency: '115ms',
      accuracy: '99.2%',
      resolution: '94% first-contact CSAT',
    },
    accentColor: '#c084fc',
    features: ['Instant payment tokenization', 'Multilingual auto-detection', 'Return QR generation over SMS'],
    voices: {
      female: {
        gender: 'female',
        name: 'Jessica (Playful & Warm)',
        elevenLabsId: 'cgSgspJ2msm6clMCkdW9',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3',
        tone: 'Friendly, upbeat, modern concierge tone',
        sampleScript: 'Hi there! Your bespoke Italian leather luggage was dispatched this morning and will arrive by tomorrow afternoon. Would you like me to text you the courier tracking link right now?',
        pitch: 1.0,
        rate: 1.0,
      },
      male: {
        gender: 'male',
        name: 'Chris (Charming & Natural)',
        elevenLabsId: 'iP95p4xoKVk53GoZ742B',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3',
        tone: 'Attentive, courteous, helpful retail specialist',
        sampleScript: 'Hello! I can process your exchange for the charcoal wool overcoat in size large immediately. I will email the pre-paid return slip while we are on the line.',
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
];
