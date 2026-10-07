#!/usr/bin/env node
/**
 * 기간 전체 단골(재방문) 손님 분석 — 하루 1·2항차 구분 없이 전체 승선 횟수 집계
 *
 * Usage: node scripts/voyage-stats/analyze-repeat-customers.js
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

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * @param {import('./types').ParsedPassenger} passenger
 * @returns {string}
 */
function passengerKey(passenger) {
  if (passenger.name && passenger.birth) {
    return `${passenger.name}|${passenger.birth}`;
  }
  return `unknown|${passenger.birth}|${passenger.gender}`;
}

/**
 * @param {import('@google-cloud/vision').ImageAnnotatorClient} visionClient
 * @param {string} imageUrl
 */
async function ocrImage(visionClient, imageUrl) {
  const buffer = await fetchImageBuffer(imageUrl);
  const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
  return result.fullTextAnnotation?.text || '';
}

async function fetchAllConfirmedTrips(db) {
  const tripsQuery = query(
    collection(db, 'trips'),
    where('__name__', '>=', config.dateStart),
    where('__name__', '<=', config.dateEnd)
  );
  const snapshot = await getDocs(tripsQuery);
  /** @type {Array<{ date: string, tripNumber: number, rosterImageUrl: string }>} */
  const records = [];

  snapshot.forEach((docSnap) => {
    const date = docSnap.id;
    const data = docSnap.data();
    for (let tripNumber = 1; tripNumber <= config.maxTripsPerDay; tripNumber += 1) {
      const trip = data[`trip${tripNumber}`];
      if (!trip?.confirmed || !trip.rosterImageUrl) continue;
      records.push({ date, tripNumber, rosterImageUrl: trip.rosterImageUrl });
    }
  });

  return records.sort((a, b) => a.date.localeCompare(b.date) || a.tripNumber - b.tripNumber);
}

/**
 * @param {Map<string, object>} customers
 * @param {import('./types').ParsedPassenger} passenger
 * @param {{ date: string, tripNumber: number }} visit
 */
function recordVisit(customers, passenger, visit) {
  const key = passengerKey(passenger);
  const existing = customers.get(key);

  if (existing) {
    existing.visitCount += 1;
    existing.visits.push({ date: visit.date, tripNumber: visit.tripNumber });
    if (!existing.name && passenger.name) existing.name = passenger.name;
  } else {
    customers.set(key, {
      name: passenger.name,
      birth: passenger.birth,
      gender: passenger.gender,
      ageBucket: passenger.ageBucket,
      visitCount: 1,
      visits: [{ date: visit.date, tripNumber: visit.tripNumber }],
    });
  }
}

function buildVisitDistribution(repeatCustomers) {
  /** @type {Record<string, number>} */
  const dist = {};
  for (const c of repeatCustomers) {
    const bucket =
      c.visitCount >= 10 ? '10회 이상' : `${c.visitCount}회`;
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return dist;
}

async function main() {
  console.log('=== 단골(재방문) 손님 분석 ===');
  console.log(`Period: ${config.dateStart} ~ ${config.dateEnd}\n`);

  const app = initializeApp({
    apiKey: config.firebase.apiKey,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
  const db = getFirestore(app);
  const visionClient = new vision.ImageAnnotatorClient({ projectId: config.visionProjectId });

  const trips = await fetchAllConfirmedTrips(db);
  console.log(`확정 항차: ${trips.length}회 OCR 시작...\n`);

  /** @type {Map<string, object>} */
  const customers = new Map();
  let visionApiCalls = 0;
  let totalPersonTrips = 0;

  for (const trip of trips) {
    process.stdout.write(`  ${trip.date} trip${trip.tripNumber}... `);
    try {
      const ocrText = await ocrImage(visionClient, trip.rosterImageUrl);
      visionApiCalls += 1;
      const passengers = parseRosterOcrText(ocrText, trip.date);
      totalPersonTrips += passengers.length;

      for (const passenger of passengers) {
        recordVisit(customers, passenger, trip);
      }
      console.log(`${passengers.length}명`);
    } catch (error) {
      console.log(`실패 (${error instanceof Error ? error.message : error})`);
    }

    if (config.visionDelayMs > 0) await sleep(config.visionDelayMs);
  }

  const allCustomers = [...customers.values()];
  const uniqueCustomers = allCustomers.length;
  const repeatCustomers = allCustomers
    .filter((c) => c.visitCount >= 2)
    .sort((a, b) => b.visitCount - a.visitCount || (a.name || '').localeCompare(b.name || ''));

  const repeatPersonTrips = repeatCustomers.reduce((s, c) => s + c.visitCount, 0);

  const summary = {
    period: { start: config.dateStart, end: config.dateEnd },
    totalConfirmedTrips: trips.length,
    totalPersonTrips,
    uniqueCustomers,
    repeatCustomers: {
      count: repeatCustomers.length,
      rateAmongUniqueCustomers:
        uniqueCustomers > 0
          ? Math.round((repeatCustomers.length / uniqueCustomers) * 1000) / 10
          : 0,
      rateAmongPersonTrips:
        totalPersonTrips > 0
          ? Math.round((repeatPersonTrips / totalPersonTrips) * 1000) / 10
          : 0,
      visitDistribution: buildVisitDistribution(repeatCustomers),
      note: '2회 이상 승선 = 단골(재방문). visitCount = 확정 항차별 승선 횟수 합계.',
    },
    topRegulars: repeatCustomers.slice(0, 20).map((c) => ({
      name: c.name,
      birth: c.birth,
      gender: c.gender,
      visitCount: c.visitCount,
      firstVisit: c.visits[0]?.date,
      lastVisit: c.visits[c.visits.length - 1]?.date,
      visitDates: [...new Set(c.visits.map((v) => v.date))].sort(),
    })),
    visionApiCalls,
    generatedAt: new Date().toISOString(),
  };

  const customerList = repeatCustomers.map((c) => ({
    name: c.name,
    birth: c.birth,
    gender: c.gender,
    visitCount: c.visitCount,
    visits: c.visits.sort(
      (a, b) => a.date.localeCompare(b.date) || a.tripNumber - b.tripNumber
    ),
  }));

  const outputDir = config.outputDir;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const summaryPath = path.join(outputDir, 'repeat_customers_summary.json');
  const listPath = path.join(outputDir, 'repeat_customers.csv');
  const jsonPath = path.join(outputDir, 'repeat_customers.json');

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(jsonPath, JSON.stringify(customerList, null, 2));

  const csvHeader = 'name,birth,gender,visitCount,visitDates';
  const csvRows = customerList.map((c) => {
    const dates = [...new Set(c.visits.map((v) => v.date))].sort().join(';');
    return [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.birth,
      c.gender,
      c.visitCount,
      `"${dates}"`,
    ].join(',');
  });
  fs.writeFileSync(listPath, [csvHeader, ...csvRows].join('\n'));

  const existingSummaryPath = path.join(outputDir, 'summary.json');
  if (fs.existsSync(existingSummaryPath)) {
    const existing = JSON.parse(fs.readFileSync(existingSummaryPath, 'utf8'));
    existing.repeatCustomers = {
      uniqueCustomers: summary.uniqueCustomers,
      repeatCustomerCount: summary.repeatCustomers.count,
      repeatRateAmongUnique: summary.repeatCustomers.rateAmongUniqueCustomers,
      reportPaths: {
        summary: 'repeat_customers_summary.json',
        list: 'repeat_customers.csv',
        detail: 'repeat_customers.json',
      },
    };
    fs.writeFileSync(existingSummaryPath, JSON.stringify(existing, null, 2));
  }

  console.log('\n=== 요약 ===');
  console.log(`고유 승선객: ${uniqueCustomers}명`);
  console.log(`단골(2회 이상): ${repeatCustomers.length}명 (${summary.repeatCustomers.rateAmongUniqueCustomers}%)`);
  console.log(`방문 횟수 분포:`, summary.repeatCustomers.visitDistribution);
  console.log('\n=== TOP 10 단골 ===');
  for (const c of repeatCustomers.slice(0, 10)) {
    const dates = [...new Set(c.visits.map((v) => v.date))].sort();
    console.log(
      `  ${c.name || '(이름미상)'} (${c.birth}) — ${c.visitCount}회 [${dates.join(', ')}]`
    );
  }
  console.log(`\n저장:\n  ${summaryPath}\n  ${listPath}\n  ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
