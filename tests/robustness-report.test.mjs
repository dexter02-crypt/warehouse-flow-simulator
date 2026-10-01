import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { analyzeRobustness } from '../src/simulation/robustness.js';
import {
  ROBUSTNESS_ENGINE_VERSION,
  createRobustnessReport,
  serializeRobustnessReport,
  reproduceRobustnessReport
} from '../src/io/robustness-report.js';

const scenario = {
  version: 1,
  name: 'Robustness fixture',
  warehouse: {
    grid: {
      width: 5,
      height: 3,
      cells: Array(15).fill(1)
    },
    depot: 10,
    slots: [
      {
        id: 'N',
        index: 11,
        zone: 'ambient',
        capacity: 4,
        maxWeight: 10
      },
      {
        id: 'M',
        index: 7,
        zone: 'ambient',
        capacity: 4,
        maxWeight: 10
      },
      {
        id: 'F',
        index: 4,
        zone: 'ambient',
        capacity: 4,
        maxWeight: 10
      }
    ]
  },
  skus: [
    {
      sku: 'A',
      picksPerDay: 100,
      size: 1,
      weight: 1,
      zone: 'ambient',
      demandCV: .2,
      slotId: 'F'
    },
    {
      sku: 'B',
      picksPerDay: 50,
      size: 1,
      weight: 1,
      zone: 'ambient',
      demandCV: .6,
      slotId: 'M'
    }
  ],
  orders: null
};

const current = new Map([
  ['A', 'F'],
  ['B', 'M']
]);

const suggested = new Map([
  ['A', 'N'],
  ['B', 'M']
]);

const orderConfig = {
  count: 12,
  seed: 42,
  maxLines: 2
};

const robustnessConfig = {
  runs: 4
};

function makeReport() {
  const result = analyzeRobustness(
    scenario.warehouse,
    scenario.skus,
    current,
    suggested,
    orderConfig,
    {
      ...robustnessConfig,
      algorithm: 'astar'
    }
  );

  return createRobustnessReport({
    scenario,
    current,
    suggested,
    result,
    orderConfig,
    robustnessConfig,
    generatedAt: '2026-10-01T00:00:00.000Z'
  });
}

test('robustness report round-trip reproduces the recorded result', () => {
  const report = makeReport();
  const verified = reproduceRobustnessReport(
    serializeRobustnessReport(report)
  );

  assert.equal(verified.verified, true);
  assert.equal(verified.engineVersion, ROBUSTNESS_ENGINE_VERSION);
  assert.equal(verified.runs, 4);
  assert.equal(verified.totalOrders, 48);
});

test('tampered robustness aggregate is rejected', () => {
  const report = makeReport();
  report.result.meanReduction += 0.01;

  assert.throws(
    () => reproduceRobustnessReport(report),
    /recomputed results differ/
  );
});

test('tampered per-seed result is rejected', () => {
  const report = makeReport();
  report.result.perSeed[0].afterTotal += 1;

  assert.throws(
    () => reproduceRobustnessReport(report),
    /recomputed results differ/
  );
});

test('tampered starting seed cannot verify as the original sample', () => {
  const report = makeReport();
  report.orderConfig.seed = 43;

  assert.throws(
    () => reproduceRobustnessReport(report),
    /recomputed results differ/
  );
});

test('unsupported robustness engine is rejected', () => {
  const report = makeReport();
  report.engineVersion = '999.0.0';

  assert.throws(
    () => reproduceRobustnessReport(report),
    /Unsupported robustness report/
  );
});

test('fixed-order scenarios are rejected for multi-seed analysis', () => {
  const report = makeReport();
  report.scenario.orders = [
    {
      id: 'O00001',
      skus: ['A']
    }
  ];

  assert.throws(
    () => reproduceRobustnessReport(report),
    /require generated orders/
  );
});

test('current assignment must still equal the recorded scenario baseline', () => {
  const report = makeReport();
  report.assignments.current.A = 'N';

  assert.throws(
    () => reproduceRobustnessReport(report),
    /Current assignments do not match/
  );
});

test('robustness CLI verifies an exported report', () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'warehouse-robustness-')
  );

  try {
    const file = path.join(dir, 'report.json');
    fs.writeFileSync(
      file,
      serializeRobustnessReport(makeReport())
    );

    const result = spawnSync(
      process.execPath,
      ['tools/reproduce-robustness.mjs', file],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.verified, true);
    assert.equal(output.runs, 4);
  } finally {
    fs.rmSync(dir, {
      recursive: true,
      force: true
    });
  }
});

test('robustness CLI returns nonzero for tampered output', () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'warehouse-robustness-bad-')
  );

  try {
    const report = makeReport();
    report.result.perSeed[0].beforeTotal += 1;

    const file = path.join(dir, 'report.json');
    fs.writeFileSync(
      file,
      JSON.stringify(report)
    );

    const result = spawnSync(
      process.execPath,
      ['tools/reproduce-robustness.mjs', file],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /ROBUSTNESS CHECK FAILED/
    );
  } finally {
    fs.rmSync(dir, {
      recursive: true,
      force: true
    });
  }
});
