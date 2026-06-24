require('dotenv').config();
import {  spawn, execSync  } from 'child_process';
import path from 'path';
import http from 'http';

const DEMO_APP_DIR = path.resolve(__dirname, '../../demo-app');
const PYTHON_DIR = path.resolve(__dirname, '../../world-model-service');
const CORE_DIR = path.resolve(__dirname, '../');

function spawnService(name, command, args, cwd) {
    console.log(`Starting [${name}]...`);
    // Use shell: true to handle cross-platform command execution (e.g., npm on Windows)
    const proc = spawn(command, args, { cwd, shell: true });
    
    proc.stdout.on('data', (data) => {
        // Uncomment for deep debugging
        // console.log(`[${name}] ${data.toString().trim()}`);
    });
    
    proc.stderr.on('data', (data) => {
        // console.error(`[${name} ERROR] ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
        console.log(`[${name}] Exited with code ${code}`);
    });

    return proc;
}

async function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
            if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error(`Timeout waiting for ${url}`));
            }
            const req = http.get(url, (res) => {
                if (res.statusCode === 200 || res.statusCode === 404) {
                    clearInterval(interval);
                    resolve();
                }
            });
            req.on('error', () => {
                // Ignore, keep trying
            });
            req.end();
        }, 1000);
    });
}

async function run() {
    console.log('--- 🛠️ Booting Offline Environment 🛠️ ---');

    // 1. Start Demo App
    const demoApp = spawnService('Demo App', 'npm', ['run', 'dev'], DEMO_APP_DIR);
    
    // 2. Start Python World Model
    const worldModel = spawnService('World Model', 'uvicorn', ['main:app', '--port', '8000'], PYTHON_DIR);

    try {
        console.log('Waiting for services to come online...');
        await Promise.all([
            waitForServer('http://localhost:5173/'), // Vite
            waitForServer('http://127.0.0.1:8000/') // FastAPI
        ]);
        console.log('✅ All services online!');

        console.log('\\n--- 🚀 Running Benchmark Suite 🚀 ---');
        execSync('node src/benchmark.js', { cwd: CORE_DIR, stdio: 'inherit', env: process.env });

    } catch (err) {
        console.error('Error during execution:', err.message);
    } finally {
        console.log('\\n--- 🛑 Shutting Down Services 🛑 ---');
        // Terminate child processes
        demoApp.kill('SIGINT');
        worldModel.kill('SIGINT');
        
        // Ensure they die on Windows
        if (process.platform === 'win32') {
            execSync(`taskkill /pid ${demoApp.pid} /T /F`, { stdio: 'ignore' });
            execSync(`taskkill /pid ${worldModel.pid} /T /F`, { stdio: 'ignore' });
        }
        console.log('Cleanup complete. Offline environment successfully torn down.');
        process.exit(0);
    }
}

run();
