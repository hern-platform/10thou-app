// Franchise vertical config — 10THOU (hardware engineers)
// The core reads this object. No core code references 'hardware' or '10thou' directly.
// To add a new vertical, copy this file, swap every value, and point a new app shell at it.

window.VERTICAL_CONFIG = {
  id: 'hardware',
  name: '10THOU',
  domain: 'https://10thou.com',
  tagline: 'Hardware Reference',
  description: 'Hardware reference tool for mechanical engineers and product designers. Fasteners, bearings, O-rings, GD\u0026T, calculators, and more.',

  brand: {
    themeColor: '#4A80B0',
    accent: '#2E5F8A',
    accentLt: '#4A80B0',
    accentDim: 'rgba(46,95,138,0.11)',
    accentGlow: 'rgba(46,95,138,0.22)',
    accentBorder: 'rgba(46,95,138,0.55)',
    warm: '#6B4F2A',
    warmDim: 'rgba(107,79,42,0.12)',
    warmBorder: '#6B4F2A',
    // Dark mode accent variants
    accentDark: '#5B90C0',
    accentLtDark: '#7AADD4',
    accentDimDark: 'rgba(91,144,192,0.15)',
    accentGlowDark: 'rgba(91,144,192,0.26)',
    accentBorderDark: 'rgba(91,144,192,0.55)',
    warmDark: '#C09A6A',
    warmDimDark: 'rgba(192,154,106,0.14)',
    warmBorderDark: 'rgba(192,154,106,0.55)',
    fontBody: 'DM Sans',
    fontMono: 'DM Mono',
    fontUrl: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap',
    defaultTheme: 'light',   // 'light' | 'dark'
  },

  auth: {
    methods: ['linkedin'],
    displayFormat: '{name} · {title}',
  },

  tiers: {
    free:  { price: 0,     canPost: false, aiQueriesPerDay: 0 },
    pro:   { price: 12,    annual: 99,     canPost: true,  aiQueriesPerDay: 'unlimited',
             label: 'PRO', stripeLinkEnvKey: 'STRIPE_PAYMENT_LINK' },
  },

  feedTags: {
    postTypes: ['Project', 'Spec', 'Build Log', 'Question'],
    specialties: ['3D Printing', 'Machining', 'Sealing', 'Electronics', 'Injection Molding', 'Fastening'],
    specTagLabel: 'Part / Spec',
  },

  forumChannels: ['3D Printing', 'Machining', 'Sealing', 'Electronics', 'Injection Molding', 'Fastening'],

  stripePaymentLink: 'https://buy.stripe.com/6oU00dcOQg6TgDTfW45Rm00',
  contactEmail: 'info@10thou.com',

  pwaManifest: {
    shortName: '10THOU',
    startUrl: '/',
    backgroundColor: '#F3F1ED',
    themeColor: '#4A80B0',
  },

  seo: {
    ogImage: 'https://10thou.com/icon-512.png',
    twitterCard: 'summary_large_image',
  },
};
