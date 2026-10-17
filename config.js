/* ================================================================
   APP CONFIG — the only file you edit after deploying the backend.
   Leave API_URL empty to run the app in DEMO mode (fake data on this phone only).
   ================================================================ */
window.APP_CONFIG = {
  // Apps Script → Deploy → Web app URL (ends with /exec)
  API_URL: '',

  // Google Cloud Console → Credentials → OAuth client ID (same one as in Code.gs)
  GOOGLE_CLIENT_ID: '',

  // Shown on the sign-in screen before anyone logs in. After sign-in, the names in the App Settings sheet are used.
  APP_NAME: 'Media Gear',
  ORG_NAME: 'UmmahPrima Network',

  // The home screen that holds all the team apps.
  HUB_NAME: 'UmmahPrima Network',
  HUB_TAGLINE: 'Team apps',
  // Testing release before 1.0. Bump this when you upload a new version.
  VERSION: '0.9.0',
  VERSION_LABEL: 'Beta',
  VERSION_NAME: 'First Take',
  // status: 'live' opens the app, 'soon' shows "Coming soon". Add more apps here later.
  APPS: [
    { id: 'media-gear', name: 'Production - Media Gear', desc: 'Book, track and return media equipment', icon: 'camera', status: 'live', version: '0.9' },
    { id: 'post-production', name: 'Post Production', desc: 'Editing jobs, reviews and delivery', note: 'Keepsake: every finished video listed in one place, so it is easy to find, review edits and track output KPI.', icon: 'film', status: 'soon' },
    { id: 'graphic-design', name: 'Graphic Design', desc: 'Design requests and approvals', icon: 'pen', status: 'soon' },
    { id: 'subscriptions', name: 'Subscription List', desc: 'Software subscriptions and renewals', icon: 'subs', status: 'soon' }
  ]
};
