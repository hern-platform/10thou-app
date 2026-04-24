// Franchise vertical config — 12TWO (electricians)
// Pronounced "twelve-two" — NEC shorthand for 12/2 wire (12-gauge, 2-conductor + ground).
// The most-used residential wire config in North America. If you know what it means, you're in the trade.

window.VERTICAL_CONFIG = {
  id: 'electrical',
  name: '12TWO',
  domain: 'https://12two.app',
  tagline: 'The pocket NEC.',
  description: 'NEC 2026 reference, electrical calculators, and a verified community for licensed electricians.',

  brand: {
    themeColor: '#C97B3C',
    accent: '#C97B3C',          // copper
    accentLt: '#D98E52',
    accentDim: 'rgba(201,123,60,0.12)',
    accentGlow: 'rgba(201,123,60,0.22)',
    accentBorder: 'rgba(201,123,60,0.55)',
    warm: '#F4C430',             // safety yellow
    warmDim: 'rgba(244,196,48,0.13)',
    warmBorder: 'rgba(244,196,48,0.55)',
    danger: '#D64545',           // hot / energized
    success: '#4A8B5C',          // grounded
    // Dark mode (same — dark is default for 12TWO)
    accentDark: '#D98E52',
    accentLtDark: '#E8A366',
    accentDimDark: 'rgba(201,123,60,0.16)',
    accentGlowDark: 'rgba(201,123,60,0.28)',
    accentBorderDark: 'rgba(201,123,60,0.6)',
    warmDark: '#F4C430',
    warmDimDark: 'rgba(244,196,48,0.14)',
    warmBorderDark: 'rgba(244,196,48,0.55)',
    fontBody: 'Inter',
    fontMono: 'JetBrains Mono',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap',
    defaultTheme: 'dark',        // electricians work in dim spaces
  },

  auth: {
    methods: ['linkedin', 'license'],  // license = state board lookup (preferred)
    licenseTypes: ['journeyman', 'master', 'apprentice', 'contractor'],
    displayFormat: '{name} · {tier} · {years}yr',  // e.g. "David Park · JW · 8yr"
  },

  tiers: {
    free:        { price: 0,      canPost: false, aiQueriesPerDay: 3,
                   label: 'Free',       gates: 'Read feed/forum, all calculators, 3 AI queries/day' },
    apprentice:  { price: 9.99,   annual: 79,     canPost: true,  aiQueriesPerDay: 'unlimited',
                   label: 'Apprentice Pro', gates: 'Post, exam prep, unlimited AI, offline mode' },
    journeyman:  { price: 19.99,  annual: 159,    canPost: true,  aiQueriesPerDay: 'unlimited', jobBoard: true,
                   label: 'Journeyman Pro', gates: '+ AHJ-by-ZIP, BOM export, job board, pro badge' },
    contractor:  { price: 49,     perSeat: true,  teamSpaces: true,
                   label: 'Contractor',   gates: '+ team spaces, apprentice tracking, branded bids' },
  },

  feedTags: {
    postTypes: ['Panel', 'Conduit Run', 'Troubleshoot', 'Before/After', 'Tool Mod', 'Code Q', 'Install Tip', 'Oh Shit'],
    specialties: ['Residential', 'Commercial', 'Industrial', 'Solar', 'EV', 'Low-V', 'Controls', 'Service'],
    specTagLabel: 'NEC Article',
    specTagLinkPattern: '/reference/nec/:value',  // NEC article becomes a clickable deep-link
  },

  forumChannels: [
    'Residential', 'Commercial', 'Industrial', 'Solar+Storage',
    'EV Infrastructure', 'Data Center', 'Controls/PLC', 'Low-Voltage',
    'Service/Troubleshooting', 'Code Interpretation', 'Apprenticeship', 'Business/Bidding',
  ],

  stripePaymentLink: '',  // TODO: set up Stripe product for 12TWO
  contactEmail: 'info@12two.app',

  pwaManifest: {
    shortName: '12TWO',
    startUrl: '/',
    backgroundColor: '#1A1A1A',
    themeColor: '#C97B3C',
  },

  seo: {
    ogImage: 'https://12two.app/icon-512.png',
    twitterCard: 'summary_large_image',
  },

  // 12TWO-only: NEC data paths (resolved at build/serve time)
  data: {
    referenceCorpus: '/verticals/electrical/data/nec-2026.json',
    calculators: '/verticals/electrical/calculators/index.js',
  },
};
