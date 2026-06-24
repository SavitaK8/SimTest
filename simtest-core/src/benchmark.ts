require('dotenv').config();
import {  execSync  } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPORT_PATH = path.resolve(__dirname, '../generated-tests/report.json');
const BENCHMARK_OUT = path.resolve(__dirname, '../generated-tests/benchmark-results.csv');
const BENCHMARK_MD = path.resolve(__dirname, '../generated-tests/benchmark-report.md');

const RUNS = [
    { name: 'BFS Baseline', env: { USE_NEURAL_WM: 'false', GEMINI_API_KEY: '' } },
    { name: 'LLM Baseline', env: { USE_NEURAL_WM: 'false' } }, // Inherits real API key from shell
    { name: 'Neural Dreamer', env: { USE_NEURAL_WM: 'true', GEMINI_API_KEY: '' } }
];

const NUM_TRIALS = 1; // Increase for statistically significant trials

function runExplorer(envOverrides) {
    const env = { ...process.env, ...envOverrides };
    const start = Date.now();
    try {
        console.log('Running SimTest Explorer...');
        execSync('node src/index.js', { env, stdio: 'inherit' });
    } catch (e) {
        console.warn('Explorer threw an error or exited with non-zero status. Proceeding to analyze partial results.');
    }
    return (Date.now() - start) / 1000;
}

function analyzeReport(durationSec) {
    if (!fs.existsSync(REPORT_PATH)) return null;
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    
    const bugs = report.bugs || [];
    const totalBugs = bugs.length;
    const riskScore = bugs.reduce((sum, b) => sum + (b.score || 0), 0);
    const transitionsExplored = report.transitions ? report.transitions.length : 1;
    const statesDiscovered = report.states ? report.states.length : 1;
    
    // Efficiency: Bugs found per 100 transitions
    const efficiency = (totalBugs / transitionsExplored) * 100; 

    // Research Metrics
    const bugDiscoveryRate = (totalBugs / Math.max(durationSec, 1)) * 60; // Bugs / min
    const coverageGrowthRate = (statesDiscovered / Math.max(durationSec, 1)) * 60; // States / min

    return {
        durationSec,
        totalBugs,
        riskScore,
        statesDiscovered,
        transitionsExplored,
        efficiency,
        bugDiscoveryRate,
        coverageGrowthRate
    };
}

async function runBenchmark() {
    console.log('🚀 Starting Phase 5A Empirical Benchmark Engine');
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ WARNING: GEMINI_API_KEY is not set. The LLM Baseline will fallback to BFS and invalidate the comparison.');
    }

    const results = [];

    for (const run of RUNS) {
        for (let trial = 1; trial <= NUM_TRIALS; trial++) {
            console.log(`\\n--- Executing ${run.name} (Trial ${trial}/${NUM_TRIALS}) ---`);
            const duration = runExplorer(run.env);
            const metrics = analyzeReport(duration);
            
            if (metrics) {
                results.push({
                    runName: run.name,
                    trial,
                    ...metrics
                });
            }
        }
    }

    generateReports(results);
}

function generateReports(results) {
    // 1. CSV
    const headers = ['Strategy', 'Trial', 'Duration(s)', 'States', 'Transitions', 'Bugs', 'RiskScore', 'Efficiency(%)', 'Bugs/Min', 'States/Min'];
    let csv = headers.join(',') + '\\n';
    results.forEach(r => {
        csv += `${r.runName},${r.trial},${r.durationSec.toFixed(2)},${r.statesDiscovered},${r.transitionsExplored},${r.totalBugs},${r.riskScore},${r.efficiency.toFixed(2)},${r.bugDiscoveryRate.toFixed(2)},${r.coverageGrowthRate.toFixed(2)}\\n`;
    });
    fs.writeFileSync(BENCHMARK_OUT, csv);

    // 2. Markdown
    let md = `# Phase 5A: SimTest Empirical Benchmark Results\\n\\n`;
    md += `| Strategy | Duration (s) | Bugs Found | Risk Score | Efficiency | Bugs/Min | States/Min |\\n`;
    md += `|---|---|---|---|---|---|---|\\n`;
    
    for (const run of RUNS) {
        const stratResults = results.filter(r => r.runName === run.name);
        if (stratResults.length === 0) continue;
        
        const avgDuration = stratResults.reduce((sum, r) => sum + r.durationSec, 0) / stratResults.length;
        const avgBugs = stratResults.reduce((sum, r) => sum + r.totalBugs, 0) / stratResults.length;
        const avgScore = stratResults.reduce((sum, r) => sum + r.riskScore, 0) / stratResults.length;
        const avgEfficiency = stratResults.reduce((sum, r) => sum + r.efficiency, 0) / stratResults.length;
        const avgBugsMin = stratResults.reduce((sum, r) => sum + r.bugDiscoveryRate, 0) / stratResults.length;
        const avgStatesMin = stratResults.reduce((sum, r) => sum + r.coverageGrowthRate, 0) / stratResults.length;

        md += `| **${run.name}** | ${avgDuration.toFixed(2)}s | ${avgBugs.toFixed(1)} | **${avgScore.toFixed(1)}** | ${avgEfficiency.toFixed(2)}% | ${avgBugsMin.toFixed(2)} | ${avgStatesMin.toFixed(2)} |\\n`;
    }

    md += `\\n## Insights\\n`;
    md += `- **Bug Discovery Rate**: Bugs found per minute. Higher is better.\\n`;
    md += `- **Coverage Growth Rate**: New states discovered per minute. Indicates exploration speed.\\n`;
    md += `- **Exploration Efficiency**: Bugs found per 100 transitions.\\n`;
    md += `\\n*Note: To run statistically significant trials for Phase 5.5, change \`NUM_TRIALS\` to 10 or 30.*\\n`;

    fs.writeFileSync(BENCHMARK_MD, md);
    console.log(`\\n✅ Benchmarking complete!\\nResults saved to:\\n - ${BENCHMARK_MD}\\n - ${BENCHMARK_OUT}`);
}

runBenchmark();
