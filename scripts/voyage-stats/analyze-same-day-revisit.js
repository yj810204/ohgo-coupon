#!/usr/bin/env node
/**
 * 동일일(같은 날짜) 2항차 이상 출항일에서 재방문(동일인 중복 승선) 분석
 *
 * Usage: node scripts/voyage-stats/analyze-same-day-revisit.js
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
  return `${passenger.birth}|${passenger.gender}`;
}

/**
 * @param {Array<{ tripNumber: number, passengers: import('./types').ParsedPassenger[] }>} dayTrips
 */
function analyzeDayRevisits(dayTrips) {
  /** @type {Map<string, { name: string | null, birth: string, gender: string, tripNumbers: number[], count: number }>} */
  const byPerson = new Map();

  for (const { tripNumber, passengers } of dayTrips) {
    for (const passenger of passengers) {
      const key = passengerKey(passenger);
      const existing = byPerson.get(key);
      if (existing) {
        if (!existing.tripNumbers.includes(tripNumber)) {
          existing.tripNumbers.push(tripNumber);
        }
        existing.count += 1;
      } else {
        byPerson.set(key, {
          name: passenger.name,
          birth: passenger.birth,
          gender: passenger.gender,
          tripNumbers: [tripNumber],
          count: 1,
        });
      }
    }
  }

  const all = [...byPerson.values()];
  const revisitors = all.filter((p) => p.tripNumbers.length >= 2);
  const totalPersonTrips = dayTrips.reduce((sum, t) => sum + t.passengers.length, 0);
  const uniquePersons = all.length;

  return {
    totalPersonTrips,
    uniquePersons,
    revisitors,
    revisitPersonCount: revisitors.length,
    revisitRateAmongUnique:
      uniquePersons > 0 ? Math.round((revisitors.length / uniquePersons) * 1000) / 10 : 0,
    revisitRateAmongTrips:
      totalPersonTrips > 0
        ? Math.round((revisitors.reduce((s, p) => s + p.count, 0) / totalPersonTrips) * 1000) / 10
        : 0,
  };
}

async function fetchTripsWithImages(db) {
  const tripsQuery = query(
    collection(db, 'trips'),
    where('__name__', '>=', config.dateStart),
    where('__name__', '<=', config.dateEnd)
  );
  const snapshot = await getDocs(tripsQuery);
  /** @type {Map<string, Array<{ tripNumber: number, rosterImageUrl: string, confirmedAt: string }>>} */
  const byDate = new Map();

  snapshot.forEach((docSnap) => {
    const date = docSnap.id;
    const data = docSnap.data();
    for (let tripNumber = 1; tripNumber <= config.maxTripsPerDay; tripNumber += 1) {
      const trip = data[`trip${tripNumber}`];
      if (!trip?.confirmed || !trip.rosterImageUrl) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push({
        tripNumber,
        rosterImageUrl: trip.rosterImageUrl,
        confirmedAt: trip.confirmedAt || '',
      });
    }
  });

  return byDate;
}

async function main() {
  console.log('=== 동일일 재방문 분석 ===');
  console.log(`Period: ${config.dateStart} ~ ${config.dateEnd}\n`);

  const app = initializeApp({
    apiKey: config.firebase.apiKey,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
  const db = getFirestore(app);
  const visionClient = new vision.ImageAnnotatorClient({ projectId: config.visionProjectId });

  const byDate = await fetchTripsWithImages(db);
  const multiTripDates = [...byDate.entries()]
    .filter(([, trips]) => trips.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b));

  console.log(`2항차 이상 출항일: ${multiTripDates.length}일\n`);

  /** @type {Array<object>} */
  const dayDetails = [];
  let visionApiCalls = 0;
  let totalRevisitPersons = 0;
  let totalUniqueAcrossMultiDays = 0;

  for (const [date, trips] of multiTripDates) {
    /** @type {Array<{ tripNumber: number, passengers: import('./types').ParsedPassenger[] }>} */
    const dayTrips = [];

    for (const trip of trips.sort((a, b) => a.tripNumber - b.tripNumber)) {
      process.stdout.write(`  OCR ${date} trip${trip.tripNumber}... `);
      const buffer = await fetchImageBuffer(trip.rosterImageUrl);
      const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
      visionApiCalls += 1;
      const ocrText = result.fullTextAnnotation?.text || '';
      const passengers = parseRosterOcrText(ocrText, date);
      dayTrips.push({ tripNumber: trip.tripNumber, passengers });
      console.log(`${passengers.length}명`);
      await sleep(config.visionDelayMs);
    }

    const analysis = analyzeDayRevisits(dayTrips);
    totalRevisitPersons += analysis.revisitPersonCount;
    totalUniqueAcrossMultiDays += analysis.uniquePersons;

    dayDetails.push({
      date,
      tripCount: trips.length,
      ...analysis,
      revisitors: analysis.revisitors.map((r) => ({
        name: r.name,
        birth: r.birth,
        gender: r.gender,
        tripNumbers: r.tripNumbers.sort((a, b) => a - b),
        count: r.count,
      })),
    });

    if (analysis.revisitors.length > 0) {
      console.log(`    → 재방문 ${analysis.revisitPersonCount}명:`);
      for (const r of analysis.revisitors) {
        console.log(
          `       ${r.name || '(이름미상)'} (${r.birth}) — ${r.count}회, 항차 ${r.tripNumbers.join(',')}`
        );
      }
    } else {
      console.log('    → 동일일 재방문 없음');
    }
    console.log('');
  }

  const summary = {
    period: { start: config.dateStart, end: config.dateEnd },
    daysWith2PlusTrips: multiTripDates.length,
    totalRevisitPersonInstances: totalRevisitPersons,
    totalUniquePersonsOnMultiTripDays: totalUniqueAcrossMultiDays,
    overallRevisitRateAmongUnique:
      totalUniqueAcrossMultiDays > 0
        ? Math.round((totalRevisitPersons / totalUniqueAcrossMultiDays) * 1000) / 10
        : 0,
    note: '재방문 = 같은 날 2항차 이상 모두 승선 명부에 등장한 동일인 (이름+생년월일 또는 생년월일+성별 매칭)',
    visionApiCalls,
    generatedAt: new Date().toISOString(),
    dayDetails,
  };

  const outputDir = config.outputDir;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'same_day_revisit.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  const existingSummaryPath = path.join(outputDir, 'summary.json');
  if (fs.existsSync(existingSummaryPath)) {
    const existing = JSON.parse(fs.readFileSync(existingSummaryPath, 'utf8'));
    existing.sameDayRevisit = {
      daysWith2PlusTrips: summary.daysWith2PlusTrips,
      totalRevisitPersons: summary.totalRevisitPersonInstances,
      overallRevisitRateAmongUnique: summary.overallRevisitRateAmongUnique,
      reportPath: 'same_day_revisit.json',
    };
    fs.writeFileSync(existingSummaryPath, JSON.stringify(existing, null, 2));
  }

  console.log('=== 요약 ===');
  console.log(`2항차 이상 날짜: ${summary.daysWith2PlusTrips}일`);
  console.log(`동일일 재방문자(고유): ${summary.totalRevisitPersonInstances}명`);
  console.log(
    `재방문율(2항차+ 날짜 내 고유 승선객 대비): ${summary.overallRevisitRateAmongUnique}%`
  );
  console.log(`\n저장: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
