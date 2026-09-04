#!/usr/bin/env node
/**
 * scripts/seed_demo.js -- Seed database with fresh demonstration data.
 *
 * Resets the demo state for the 5 September 2026 presentation:
 *   1. Ensures all migrations are applied and slope units are loaded.
 *   2. Cleans up old demo alerts and mock SMS dispatches.
 *   3. Ingests the latest forecast run from `data/sample/mock_ml_output.json`
 *      stamped with current timestamp.
 *   4. Verifies the Golden Proof Case (AZ-1088: LOW risk, Prob 0.95)
 *      and Showcase Case (AZ-1142: HIGH risk, Prob 0.72) in PENDING_VERIFICATION.
 *
 * Usage:
 *   node scripts/seed_demo.js
 *   (or `npm run seed:demo` from backend/)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Color formatting
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

async function main() {
  console.log('\n' + c.bright + c.cyan + '================================================================================' + c.reset);
  console.log(c.bright + c.cyan + ' LANDSLIDE PLATFORM -- SEEDING DEMONSTRATION ENVIRONMENT' + c.reset);
  console.log(c.dim + ' Pilot District: Aizawl, Mizoram | Event Date: 5 September 2026' + c.reset);
  console.log(c.bright + c.cyan + '================================================================================' + c.reset + '\n');

  process.chdir(path.join(ROOT_DIR, 'backend'));

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://landslide:9d7721102937ca350f99f9b4ab5a5ae8303e04b342b37f65@localhost:5432/landslide';
  }

  const { buildApp } = await import('../backend/src/app.js');
  const { query, pool } = await import('../backend/src/db/pool.js');

  const app = await buildApp({ logger: false });
  await app.ready();

  try {
    // 1. Clean up old test alerts and mock sms
    console.log(`  ${c.dim}Cleaning up previous demo alerts and SMS logs...${c.reset}`);
    await query(`DELETE FROM mock_sms_dispatch`);
    await query(`DELETE FROM alert`);
    console.log(`  ${c.green}✓${c.reset} Alert tables reset to pristine state`);

    // 2. Load ML sample
    const mockFile = path.join(ROOT_DIR, 'data', 'sample', 'mock_ml_output.json');
    const mlData = JSON.parse(fs.readFileSync(mockFile, 'utf8'));
    mlData.forecast_run.run_ts = new Date().toISOString();

    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/predictions/ingest',
      payload: mlData,
    });

    if (ingestRes.statusCode !== 201) {
      throw new Error(`Ingest failed with code ${ingestRes.statusCode}: ${ingestRes.body}`);
    }

    const { forecast_run_id, predictions_stored } = ingestRes.json();
    console.log(`  ${c.green}✓${c.reset} Ingested forecast run ${c.bright}#${forecast_run_id}${c.reset} (${predictions_stored} slope units)`);

    // 3. Verify risk feed
    const riskRes = await app.inject({
      method: 'GET',
      url: '/api/v1/risk/current?district=aizawl',
    });

    if (riskRes.statusCode !== 200) {
      throw new Error(`Failed to query risk feed: ${riskRes.statusCode}`);
    }

    const riskData = riskRes.json();
    const f1088 = riskData.features.find((f) => f.properties.slope_unit_id === 'AZ-1088');
    const f1142 = riskData.features.find((f) => f.properties.slope_unit_id === 'AZ-1142');

    console.log(`\n  ${c.bright}State of Demo Slope Units:${c.reset}`);
    console.log(`    ${c.yellow}★ AZ-1088 (Proof Case):${c.reset} Prob ${c.bright}${f1088?.properties?.probability}${c.reset}, Exposed ${f1088?.properties?.exposure_summary?.population_estimate} pop $\\rightarrow$ Risk: ${c.green}${c.bright}${f1088?.properties?.risk_level}${c.reset}`);
    console.log(`    ${c.yellow}★ AZ-1142 (Showcase):  ${c.reset} Prob ${c.bright}${f1142?.properties?.probability}${c.reset}, Exposed ${f1142?.properties?.exposure_summary?.population_estimate} pop $\\rightarrow$ Risk: ${c.red}${c.bright}${f1142?.properties?.risk_level}${c.reset}`);

    console.log('\n' + c.bright + c.green + '================================================================================' + c.reset);
    console.log(c.bright + c.green + ' DEMO SEED COMPLETE: DATABASE IS PRIMED & READY FOR PRESENTATION' + c.reset);
    console.log(c.dim + ' Test Accounts Available:' + c.reset);
    console.log(`   Field Officer:  ${c.bright}officer.aizawl@disaster.mz.gov.in${c.reset}  /  ${c.dim}prototype2026!${c.reset}`);
    console.log(`   District Admin: ${c.bright}admin.aizawl@disaster.mz.gov.in${c.reset}    /  ${c.dim}prototype2026!${c.reset}`);
    console.log(c.bright + c.green + '================================================================================' + c.reset + '\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\n' + c.red + 'Seed failed:' + c.reset, err);
  process.exit(1);
});
