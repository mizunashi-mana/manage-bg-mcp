import fs from 'fs';
import path from 'path';

// Get process PID
const pid = process.pid;
const tmpDir = './tmp';
const pidFile = path.join(tmpDir, `test_server_${pid}.txt`);

let isShuttingDown = false;

// Create tmp directory if it doesn't exist
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Create PID file on startup
fs.writeFileSync(pidFile, `Server started with PID: ${pid}\nTo terminate this server, write 'stop' to this file.\n`);
console.log(`Test server started with PID: ${pid}`);
console.log(`Created control file: ${pidFile}`);
console.log(`To stop the server, run: echo "stop" > ${pidFile}`);

// Cleanup function
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    fs.unlinkSync(pidFile);
  }
  catch (_err) {
    // Ignore cleanup errors
  }
}

// Poll the file every 100ms
const pollInterval = setInterval(() => {
  if (isShuttingDown) return;

  try {
    if (fs.existsSync(pidFile)) {
      const content = fs.readFileSync(pidFile, 'utf-8');
      if (content.trim() === 'stop') {
        shutdown(`Stop command detected in ${pidFile}`);
      }
    }
    else {
      // If file was deleted, treat it as a stop signal
      shutdown(`Control file ${pidFile} was deleted`);
    }
  }
  catch (err) {
    console.error(`Error reading control file: ${err.message}`);
    // Continue polling even if there's an error
  }
}, 100);

// Keep the process running with a heartbeat
let heartbeatCount = 0;
const heartbeatInterval = setInterval(() => {
  heartbeatCount++;
  if (heartbeatCount % 50 === 0) { // Every 5 seconds (50 * 100ms)
    console.log(`Server is running... (heartbeat ${heartbeatCount})`);
  }
}, 100);

// Shutdown function
function shutdown(reason) {
  console.log(`${reason}. Shutting down...`);
  cleanup();
  clearInterval(pollInterval);
  clearInterval(heartbeatInterval);
  // eslint-disable-next-line n/no-process-exit -- process.exit is needed for test server graceful shutdown
  process.exit(0);
}

// Graceful shutdown on SIGTERM/SIGINT
process.on('SIGTERM', () => {
  shutdown('Received SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('Received SIGINT');
});

// Clear heartbeat on shutdown
process.on('exit', () => {
  clearInterval(heartbeatInterval);
});

console.log('Server is running. Polling for stop command every 100ms...');
