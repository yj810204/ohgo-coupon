#!/usr/bin/env node
/**
 * 1회성 출항 통계 스크립트 (앱 수정 없음)
 *
 * Step 1: Firestore trips 인벤토리 (출항일·항차·이미지 커버리지)
 * Step 2: Google Cloud Vision Document OCR → 승선객·나이대·성별
 * Step 3: summary.json + trips_detail.csv 출력
 *
 * Usage:
 *   node scripts/voyage-stats/run.js
 *   SKIP_OCR=1 node scripts/voyage-stats/run.js   # Step 1 only
 *   GCP_VISION_PROJECT_ID=my-project node scripts/voyage-stats/run.js
 *
 * Prerequisites:
 *   - gcloud auth application-default login (Vision API enabled on vision project)
 *   - npm install (firebase-admin, @google-cloud/vision in devDependencies)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const vision = require('@google-cloud/vision');

const config = require('./config');
const { parseRosterOcrText } = require('./parse-roster-text');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<import('./types').TripRecord[]>}
 */
async function fetchConfirmedTrips(db) {
  const tripsQuery = query(
    collection(db, 'trips'),
    where('__name__', '>=', config.dateStart),
    where('__name__', '<=', config.dateEnd)
  );

  const snapshot = await getDocs(tripsQuery);
  /** @type {import('./types').TripRecord[]} */
  const records = [];

  snapshot.forEach((docSnap) => {
    const date = docSnap.id;
    const data = docSnap.data();

    for (let tripNumber = 1; tripNumber <= config.maxTripsPerDay; tripNumber += 1) {
      const tripKey = `trip${tripNumber}`;
      const trip = data[tripKey];
      if (!trip?.confirmed) continue;

      records.push({
        date,
        tripNumber,
        confirmedAt: trip.confirmedAt || '',
        confirmed: true,
        imageAvailable: Boolean(trip.rosterImageUrl),
        rosterImageUrl: trip.rosterImageUrl || null,
        passengerCount: null,
        ocrStatus: trip.rosterImageUrl ? 'pending' : 'no_image',
      });
    }
  });

  records.sort((a, b) => a.date.localeCompare(b.date) || a.tripNumber - b.tripNumber);
  return records;
}

/**
 * @param {import('./types').TripRecord[]} records
 */
function buildInventorySummary(records) {
  const uniqueDates = new Set(records.map((r) => r.date));
  const withImage = records.filter((r) => r.imageAvailable).length;
  const withoutImage = records.length - withImage;

  /** @type {Record<string, number>} */
  const byMonth = {};
  for (const record of records) {
    const month = record.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  }

  return {
    firebaseProjectId: config.firebase.projectId,
    visionProjectId: config.visionProjectId,
    period: { start: config.dateStart, end: config.dateEnd },
    totalConfirmedTrips: records.length,
    totalSailingDays: uniqueDates.size,
    imageCoverage: {
      withImage,
      withoutImage,
      percent: records.length ? Math.round((withImage / records.length) * 1000) / 10 : 0,
    },
    tripsByMonth: byMonth,
  };
}

/**
 * @param {import('@google-cloud/vision').ImageAnnotatorClient} visionClient
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
async function runVisionOcr(visionClient, imageUrl) {
  const buffer = await fetchImageBuffer(imageUrl);
  const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
  return result.fullTextAnnotation?.text || '';
}

/**
 * @param {import('./types').TripRecord[]} records
 * @param {import('@google-cloud/vision').ImageAnnotatorClient} visionClient
 */
async function processOcr(records, visionClient) {
  let apiCalls = 0;

  for (const record of records) {
    if (!record.imageAvailable || !record.rosterImageUrl) {
      record.passengerCount = null;
      record.ocrStatus = 'no_image';
      continue;
    }

    try {
      const ocrText = await runVisionOcr(visionClient, record.rosterImageUrl);
      apiCalls += 1;

      const passengers = parseRosterOcrText(ocrText, record.date);
      record.passengers = passengers;
      record.passengerCount = passengers.length;
      record.ocrStatus = passengers.length > 0 ? 'ok' : 'empty';

      process.stdout.write(
        `  OCR ${record.date} trip${record.tripNumber}: ${passengers.length} passengers\n`
      );
    } catch (error) {
      record.passengerCount = null;
      record.ocrStatus = `error: ${error instanceof Error ? error.message : String(error)}`;
      process.stderr.write(
        `  OCR failed ${record.date} trip${record.tripNumber}: ${record.ocrStatus}\n`
      );
    }

    if (config.visionDelayMs > 0) {
      await sleep(config.visionDelayMs);
    }
  }

  return apiCalls;
}

/**
 * @param {import('./types').TripRecord[]} records
 * @param {number} visionApiCalls
 */
function buildFinalSummary(records, visionApiCalls) {
  const inventory = buildInventorySummary(records);
  const ocrRecords = records.filter((r) => r.ocrStatus === 'ok');

  let totalPassengers = 0;
  /** @type {Record<string, number>} */
  const ageBuckets = {};
  /** @type {Record<string, number>} */
  const genderCounts = { 남: 0, 여: 0, unknown: 0 };

  for (const record of ocrRecords) {
    totalPassengers += record.passengerCount || 0;
    for (const passenger of record.passengers || []) {
      ageBuckets[passenger.ageBucket] = (ageBuckets[passenger.ageBucket] || 0) + 1;
      if (passenger.gender === '남' || passenger.gender === '여') {
        genderCounts[passenger.gender] += 1;
      } else {
        genderCounts.unknown += 1;
      }
    }
  }

  const bucketOrder = ['10세 미만', '10대', '20대', '30대', '40대', '50대', '60대', '70대 이상', 'unknown'];
  const sortedAgeBuckets = Object.fromEntries(
    bucketOrder
      .filter((key) => ageBuckets[key])
      .map((key) => [key, ageBuckets[key]])
  );

  return {
    ...inventory,
    passengers: {
      totalPersonTrips: totalPassengers,
      ocrSuccessTrips: ocrRecords.length,
      ocrFailedTrips: records.filter((r) => r.imageAvailable && r.ocrStatus !== 'ok').length,
      noImageTrips: records.filter((r) => !r.imageAvailable).length,
      ageBuckets: sortedAgeBuckets,
      gender: genderCounts,
      note: 'totalPersonTrips = 항차별 승선객 합계 (동일인 재방문 시 중복 포함). 선장/선원 제외.',
    },
    visionApiCalls,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {import('./types').TripRecord[]} records
 * @returns {string}
 */
function toCsv(records) {
  const header = [
    'date',
    'tripNumber',
    'confirmedAt',
    'passengerCount',
    'imageAvailable',
    'ocrStatus',
  ].join(',');

  const rows = records.map((r) =>
    [
      r.date,
      r.tripNumber,
      `"${(r.confirmedAt || '').replace(/"/g, '""')}"`,
      r.passengerCount ?? '',
      r.imageAvailable,
      `"${r.ocrStatus.replace(/"/g, '""')}"`,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

function ensureOutputDir() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

async function main() {
  ensureOutputDir();

  console.log('=== Firebase 출항 통계 (1회성) ===');
  console.log(`Firebase project: ${config.firebase.projectId}`);
  console.log(`Vision project:   ${config.visionProjectId}`);
  console.log(`Period:           ${config.dateStart} ~ ${config.dateEnd}`);
  console.log('');

  const app = initializeApp({
    apiKey: config.firebase.apiKey,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
  const db = getFirestore(app);

  console.log('Step 1: Fetching confirmed trips...');
  const records = await fetchConfirmedTrips(db);
  const inventory = buildInventorySummary(records);

  console.log(`  Documents in range: ${inventory.totalSailingDays} days with trips`);
  console.log(`  Confirmed trips:    ${inventory.totalConfirmedTrips}`);
  console.log(`  Sailing days:       ${inventory.totalSailingDays}`);
  console.log(
    `  Image coverage:     ${inventory.imageCoverage.withImage}/${inventory.totalConfirmedTrips} (${inventory.imageCoverage.percent}%)`
  );
  console.log('  Trips by month:', inventory.tripsByMonth);
  console.log('');

  let visionApiCalls = 0;

  if (config.skipOcr) {
    console.log('Step 2: SKIP_OCR=1 — skipping Vision OCR');
  } else {
    console.log('Step 2: Google Cloud Vision OCR...');
    const visionClient = new vision.ImageAnnotatorClient({ projectId: config.visionProjectId });
    visionApiCalls = await processOcr(records, visionClient);
    console.log(`  Vision API calls: ${visionApiCalls}`);
    console.log('');
  }

  console.log('Step 3: Writing reports...');
  ensureOutputDir();

  const summary = buildFinalSummary(records, visionApiCalls);
  const inventoryPath = path.join(config.outputDir, 'inventory.json');
  const summaryPath = path.join(config.outputDir, 'summary.json');
  const csvPath = path.join(config.outputDir, 'trips_detail.csv');
  const detailPath = path.join(config.outputDir, 'trips_detail.json');

  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(csvPath, toCsv(records));
  fs.writeFileSync(
    detailPath,
    JSON.stringify(
      records.map(({ rosterImageUrl, passengers, ...rest }) => ({
        ...rest,
        passengerCount: rest.passengerCount,
        passengers,
      })),
      null,
      2
    )
  );

  console.log(`  ${inventoryPath}`);
  console.log(`  ${summaryPath}`);
  console.log(`  ${csvPath}`);
  console.log(`  ${detailPath}`);
  console.log('');
  console.log('=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
