/** @typedef {import('./types').VoyageStatsConfig} VoyageStatsConfig */

/** @type {VoyageStatsConfig} */
module.exports = {
  firebase: {
    apiKey: 'AIzaSyDvcQMMs5-B9LJanDPLMOqTkwd3KMUg2u4',
    projectId: 'ohgo-dev-bc602',
    storageBucket: 'ohgo-dev-bc602.firebasestorage.app',
  },
  /** Vision API billing project (ADC must have vision access). */
  visionProjectId: process.env.GCP_VISION_PROJECT_ID || 'mos-order-51d57',
  dateStart: '2025-09-24',
  dateEnd: '2026-06-17',
  maxTripsPerDay: 3,
  outputDir: require('path').join(__dirname, 'output'),
  /** Delay between Vision API calls (ms) to avoid rate limits. */
  visionDelayMs: Number(process.env.VISION_DELAY_MS || 300),
  /** Set SKIP_OCR=1 to run Step 1 inventory only. */
  skipOcr: process.env.SKIP_OCR === '1',
};
