const { execSync } = require('child_process');

console.log("Running tsx...");
try {
  const result = execSync('npx tsx test-ai.ts', { encoding: 'utf-8', cwd: '.' });
  console.log(result);
} catch (e) {
  console.log("ERROR OUTPUT:");
  console.log(e.stdout);
  console.log(e.stderr);
}
