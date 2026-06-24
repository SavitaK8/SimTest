#!/usr/bin/env node
'use strict';

/**
 * Phase 5.5: Statistical Significance Engine
 * 
 * Reads benchmark-results.csv and performs:
 * - Welch's t-test (or Mann-Whitney U) between strategy pairs
 * - Cohen's d effect size
 * - Outputs statistical-significance-report.md
 */

import fs from 'fs';
import path from 'path';

const CSV_PATH = path.resolve(__dirname, '../generated-tests/benchmark-results.csv');
const REPORT_OUT = path.resolve(__dirname, '../generated-tests/statistical-significance-report.md');

// ──────────────────────────────────
// Pure-JS Statistics Utilities
// ──────────────────────────────────

function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr) {
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function stddev(arr) {
    return Math.sqrt(variance(arr));
}

/**
 * Welch's t-test (unequal variances, two-tailed).
 * Returns { t, df, p } where p is approximate via the t-distribution.
 */
function welchTTest(a, b) {
    if (a.length < 2 || b.length < 2) return { t: NaN, df: NaN, p: 1.0 };

    const ma = mean(a), mb = mean(b);
    const va = variance(a), vb = variance(b);
    const na = a.length, nb = b.length;

    const se = Math.sqrt(va / na + vb / nb);
    if (se === 0) return { t: 0, df: na + nb - 2, p: 1.0 };

    const t = (ma - mb) / se;

    // Welch-Satterthwaite degrees of freedom
    const num = (va / na + vb / nb) ** 2;
    const den = (va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1);
    const df = num / den;

    // Approximate p-value using regularised incomplete beta function
    const p = tDistPValue(Math.abs(t), df);

    return { t, df, p };
}

/**
 * Cohen's d effect size (pooled standard deviation).
 */
function cohensD(a, b) {
    const ma = mean(a), mb = mean(b);
    const na = a.length, nb = b.length;
    const va = variance(a), vb = variance(b);
    const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
    if (pooled === 0) return 0;
    return (ma - mb) / pooled;
}

function effectSizeLabel(d) {
    const abs = Math.abs(d);
    if (abs < 0.2) return 'Negligible';
    if (abs < 0.5) return 'Small';
    if (abs < 0.8) return 'Medium';
    return 'Large';
}

/**
 * Mann-Whitney U test (non-parametric).
 * For small n, returns approximate p via normal approximation.
 */
function mannWhitneyU(a, b) {
    const combined = [
        ...a.map(v => ({ v, group: 'a' })),
        ...b.map(v => ({ v, group: 'b' }))
    ].sort((x, y) => x.v - y.v);

    // Assign ranks (handle ties with average rank)
    const ranks = new Array(combined.length);
    let i = 0;
    while (i < combined.length) {
        let j = i;
        while (j < combined.length && combined[j].v === combined[i].v) j++;
        const avgRank = (i + 1 + j) / 2;
        for (let k = i; k < j; k++) ranks[k] = avgRank;
        i = j;
    }

    let R1 = 0;
    for (let k = 0; k < combined.length; k++) {
        if (combined[k].group === 'a') R1 += ranks[k];
    }

    const na = a.length, nb = b.length;
    const U1 = R1 - (na * (na + 1)) / 2;
    const U2 = na * nb - U1;
    const U = Math.min(U1, U2);

    // Normal approximation
    const mu = (na * nb) / 2;
    const sigma = Math.sqrt((na * nb * (na + nb + 1)) / 12);
    if (sigma === 0) return { U, z: 0, p: 1.0 };

    const z = (U - mu) / sigma;
    // Two-tailed p from z
    const p = 2 * (1 - normalCDF(Math.abs(z)));

    return { U, z, p };
}

// ──────────────────────────────────
// Approximations for p-values
// ──────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

/** Approximate two-tailed p-value from t-distribution using normal approx for large df */
function tDistPValue(tAbs, df) {
    // For df > 30, t approaches normal
    if (df > 30) {
        return 2 * (1 - normalCDF(tAbs));
    }
    // For smaller df, use a rougher Beta-function approximation
    const x = df / (df + tAbs * tAbs);
    const p = incompleteBetaApprox(df / 2, 0.5, x);
    return p;
}

/** Rough regularized incomplete beta via continued fraction (for t-dist p-values) */
function incompleteBetaApprox(a, b, x) {
    // Use series expansion for small x
    if (x < 0) return 0;
    if (x > 1) return 1;
    if (x === 0) return 0;
    if (x === 1) return 1;

    // Simple numerical integration (trapezoidal, 200 steps)
    const N = 200;
    const dx = x / N;
    let sum = 0;
    for (let i = 0; i <= N; i++) {
        const t = i * dx;
        const ft = Math.pow(t, a - 1) * Math.pow(1 - t, b - 1);
        sum += ft * (i === 0 || i === N ? 0.5 : 1.0);
    }
    sum *= dx;

    // Full beta function via same method over [0,1]
    const dxFull = 1.0 / N;
    let fullSum = 0;
    for (let i = 0; i <= N; i++) {
        const t = i * dxFull;
        const ft = Math.pow(t, a - 1) * Math.pow(1 - t, b - 1);
        fullSum += ft * (i === 0 || i === N ? 0.5 : 1.0);
    }
    fullSum *= dxFull;

    if (fullSum === 0) return 1;
    return sum / fullSum;
}

// ──────────────────────────────────
// Main
// ──────────────────────────────────

function loadCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ No benchmark results found at ${CSV_PATH}. Run the benchmark suite first.`);
        process.exit(1);
    }
    const raw = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n');
    const headers = raw[0].split(',');
    const rows = raw.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = cols[i]?.trim());
        return obj;
    });
    return rows;
}

function run() {
    console.log('📊 Phase 5.5: Statistical Significance Analysis\n');

    const rows = loadCSV();

    // Group by strategy
    const strategies = {};
    for (const row of rows) {
        const name = row['Strategy'];
        if (!strategies[name]) strategies[name] = [];
        strategies[name].push({
            duration: parseFloat(row['Duration(s)']) || 0,
            bugs: parseInt(row['Bugs']) || 0,
            riskScore: parseInt(row['RiskScore']) || 0,
            efficiency: parseFloat(row['Efficiency(%)']) || 0,
            bugsMin: parseFloat(row['Bugs/Min']) || 0,
            statesMin: parseFloat(row['States/Min']) || 0,
        });
    }

    const stratNames = Object.keys(strategies);

    // Compare all pairs
    const metrics = ['bugs', 'riskScore', 'duration', 'bugsMin', 'statesMin'];
    const metricLabels = {
        bugs: 'Total Bugs Found',
        riskScore: 'Risk-Weighted Score',
        duration: 'Duration (s)',
        bugsMin: 'Bug Discovery Rate (Bugs/Min)',
        statesMin: 'Coverage Growth Rate (States/Min)',
    };

    let md = `# Phase 5.5: Statistical Significance Report\n\n`;
    md += `This report tests whether differences between exploration strategies are statistically significant.\n\n`;

    for (let i = 0; i < stratNames.length; i++) {
        for (let j = i + 1; j < stratNames.length; j++) {
            const nameA = stratNames[i];
            const nameB = stratNames[j];
            const dataA = strategies[nameA];
            const dataB = strategies[nameB];

            md += `## ${nameA} vs ${nameB}\n\n`;
            md += `| Metric | Mean (${nameA}) | Mean (${nameB}) | Welch t | p-value | Cohen's d | Effect Size | Significant? |\n`;
            md += `|---|---|---|---|---|---|---|---|\n`;

            for (const metric of metrics) {
                const a = dataA.map(r => r[metric]);
                const b = dataB.map(r => r[metric]);

                const ma = mean(a);
                const mb = mean(b);

                let pVal, tStat, d;

                if (a.length >= 5 && b.length >= 5) {
                    // Prefer Welch's t-test when we have enough samples
                    const test = welchTTest(a, b);
                    tStat = test.t;
                    pVal = test.p;
                } else {
                    // Fallback to Mann-Whitney U for small samples
                    const test = mannWhitneyU(a, b);
                    tStat = test.z;
                    pVal = test.p;
                }

                d = cohensD(a, b);
                const sig = pVal < 0.05 ? '✅ Yes' : '❌ No';

                md += `| ${metricLabels[metric]} | ${ma.toFixed(2)} | ${mb.toFixed(2)} | ${isNaN(tStat) ? 'N/A' : tStat.toFixed(3)} | ${isNaN(pVal) ? 'N/A' : pVal.toFixed(4)} | ${isNaN(d) ? 'N/A' : d.toFixed(3)} | ${effectSizeLabel(d)} | ${sig} |\n`;
            }

            md += `\n`;
        }
    }

    md += `## Interpretation Guide\n\n`;
    md += `- **p-value < 0.05**: The difference is statistically significant (not due to chance).\n`;
    md += `- **Cohen's d**: Measures practical significance. |d| > 0.8 = Large effect.\n`;
    md += `- **Note**: With NUM_TRIALS = 1, statistical tests have very low power. Set NUM_TRIALS ≥ 10 in \`benchmark.js\` for credible results.\n`;

    fs.writeFileSync(REPORT_OUT, md);
    console.log(`✅ Report generated: ${REPORT_OUT}`);
}

run();
