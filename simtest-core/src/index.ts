#!/usr/bin/env node
'use strict';

import {  Command  } from 'commander';
import path from 'path';

// chalk v4 (CJS compatible)
let chalk, ora;
try {
  chalk = require('chalk');
  ora = require('ora');
} catch (e) {
  // Fallback if chalk/ora not installed
  chalk = {
    blue: s => s, green: s => s, red: s => s, yellow: s => s, cyan: s => s,
    bold: { blue: s => s, green: s => s, red: s => s, yellow: s => s, cyan: s => s, white: s => s },
    gray: s => s, white: s => s, magenta: s => s, dim: s => s
  };
  ora = (text) => ({
    start: function() { console.log(`  ${text}`); return this; },
    succeed: function(t) { console.log(`  ✓ ${t || text}`); return this; },
    fail: function(t) { console.log(`  ✗ ${t || text}`); return this; },
    text: text
  });
}

import {  StateCollector  } from './collector';
import {  StateGraph  } from './state-graph';
import {  Explorer  } from './explorer';
import {  BugFinder  } from './bug-finder';
import {  TestGenerator  } from './test-generator';
import {  ReportGenerator  } from './report-generator';

/**
 * Print the SimTest ASCII banner.
 */
function printBanner() {
  console.log('');
  console.log(chalk.bold.blue('  ┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.blue('  │') + chalk.bold.white('  🧪 SimTest — Autonomous Testing Framework  ') + chalk.bold.blue('│'));
  console.log(chalk.bold.blue('  │') + chalk.dim('     World Model Based Bug Discovery         ') + chalk.bold.blue('│'));
  console.log(chalk.bold.blue('  └─────────────────────────────────────────────┘'));
  console.log('');
}

/**
 * Main entry point.
 */
async function main() {
  const program = new Command();

  const parseNum = (val) => parseInt(val, 10);

  program
    .name('simtest')
    .description('SimTest — World Model Based Autonomous Testing Framework')
    .version('1.0.0')
    .option('-u, --url <url>', 'Target application URL', 'http://localhost:5173')
    .option('-d, --max-depth <n>', 'Maximum exploration depth', parseNum, 10)
    .option('-s, --max-states <n>', 'Maximum states to discover', parseNum, 200)
    .option('-a, --max-actions <n>', 'Maximum actions per state', parseNum, 20)
    .option('--headed', 'Run browser in headed (visible) mode', false)
    .option('--output <dir>', 'Output directory for generated tests', './generated-tests')
    .option('--dashboard <dir>', 'Dashboard data output directory', './dashboard')
    .option('--timeout <ms>', 'Action timeout in milliseconds', parseNum, 5000);

  program.parse(process.argv);
  const opts = program.opts();

  printBanner();

  const startTime = Date.now();
  let collector = null;

  try {
    // ──────────────────────────────────────
    // Phase 1: Initialize
    // ──────────────────────────────────────
    const spinner1 = ora(`Connecting to ${chalk.cyan(opts.url)}...`).start();

    collector = new StateCollector({
      headless: !opts.headed,
      timeout: opts.timeout,
      baseUrl: opts.url
    });

    await collector.init();
    spinner1.succeed(`Connected to ${chalk.cyan(opts.url)}`);

    // ──────────────────────────────────────
    // Phase 2: Setup components
    // ──────────────────────────────────────
    const spinner2 = ora('Initializing exploration engine...').start();

    const stateGraph = new StateGraph();
    const bugFinder = new BugFinder();
    const explorer = new Explorer(collector, stateGraph, bugFinder, {
      maxDepth: opts.maxDepth,
      maxStates: opts.maxStates,
      maxActionsPerState: opts.maxActions,
      actionTimeout: opts.timeout,
      startUrl: opts.url,
      onProgress: (message) => {
        spinner3.text = message;
      }
    });

    spinner2.succeed('Exploration engine ready');

    // ──────────────────────────────────────
    // Phase 3: Explore
    // ──────────────────────────────────────
    const spinner3 = ora('Exploring state space (BFS)...').start();

    const result = await explorer.explore(opts.url);

    const explorationStats = result.stats;
    spinner3.succeed(
      `Exploration complete: ${chalk.green(explorationStats.statesDiscovered)} states, ` +
      `${chalk.blue(explorationStats.transitionsFound)} transitions, ` +
      `depth ${chalk.yellow(explorationStats.depthReached)}`
    );

    // ──────────────────────────────────────
    // Phase 4: Analyze bugs
    // ──────────────────────────────────────
    const spinner4 = ora('Analyzing for bugs...').start();

    const bugs = result.bugs;
    const highBugs = bugs.filter(b => b.severity === 'high').length;
    const medBugs = bugs.filter(b => b.severity === 'medium').length;
    const lowBugs = bugs.filter(b => b.severity === 'low').length;

    if (bugs.length > 0) {
      spinner4.succeed(
        `Found ${chalk.bold.red(bugs.length)} bug(s): ` +
        `${chalk.red(`${highBugs} high`)}, ` +
        `${chalk.yellow(`${medBugs} medium`)}, ` +
        `${chalk.green(`${lowBugs} low`)}`
      );
    } else {
      spinner4.succeed(chalk.green('No bugs found!'));
    }

    // ──────────────────────────────────────
    // Phase 5: Generate outputs
    // ──────────────────────────────────────
    const spinner5 = ora('Generating test cases & reports...').start();

    const outputDir = path.resolve(opts.output);
    const dashboardDir = path.resolve(opts.dashboard);

    // Generate test files
    const testGen = new TestGenerator(stateGraph, outputDir);
    const testFiles = testGen.generateAll(bugs);

    // Generate report
    const reportGen = new ReportGenerator(stateGraph, bugs, {
      ...explorationStats,
      startUrl: opts.url
    });

    const reportPath = path.join(outputDir, 'report.json');
    reportGen.generateJSON(reportPath);

    const dashDataPath = path.join(dashboardDir, 'dashboard-data.js');
    reportGen.generateDashboardData(dashDataPath);

    spinner5.succeed(`Generated ${chalk.green(testFiles.length)} test file(s)`);

    // ──────────────────────────────────────
    // Summary
    // ──────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log('');
    console.log(chalk.bold.blue('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.bold.blue('  │') + chalk.bold.white('           Exploration Summary                ') + chalk.bold.blue('│'));
    console.log(chalk.bold.blue('  └─────────────────────────────────────────────┘'));
    console.log('');
    console.log(`  ${chalk.dim('States Discovered:')}  ${chalk.bold.green(explorationStats.statesDiscovered)}`);
    console.log(`  ${chalk.dim('Transitions Found:')}  ${chalk.bold.blue(explorationStats.transitionsFound)}`);
    console.log(`  ${chalk.dim('Actions Attempted:')}  ${chalk.bold.cyan(explorationStats.actionsAttempted)}`);
    console.log(`  ${chalk.dim('Depth Reached:    ')}  ${chalk.bold.yellow(explorationStats.depthReached)}`);
    console.log(`  ${chalk.dim('Bugs Found:       ')}  ${chalk.bold.red(bugs.length)}`);
    console.log(`  ${chalk.dim('Duration:         ')}  ${formatDuration(duration)}`);
    console.log('');

    if (bugs.length > 0) {
      console.log(chalk.bold.white('  Bug Summary:'));
      for (const bug of bugs) {
        const icon = bug.severity === 'high' ? '🔴' : bug.severity === 'medium' ? '🟡' : '🟢';
        console.log(`    ${icon} ${chalk.bold(bug.id)} [${bug.severity}] ${bug.description}`);
      }
      console.log('');
    }

    console.log(chalk.dim('  Output Files:'));
    console.log(`    📝 Tests:     ${chalk.cyan(outputDir)}`);
    console.log(`    📋 Report:    ${chalk.cyan(reportPath)}`);
    console.log(`    📊 Dashboard: ${chalk.cyan(dashDataPath)}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error(chalk.bold.red('  ✗ SimTest failed:'), error.message);
    console.error('');
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (collector) {
      try {
        await collector.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Format duration in ms to human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// Run
main();
