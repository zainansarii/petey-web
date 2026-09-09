import { spawnSync } from 'node:child_process';
import process from 'node:process';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env[key] ?? '')) throw new Error(`${key} must target a local emulator.`);
}
for (const [command, args, cwd] of [
  ['npm', ['run', 'verify'], new URL('../', import.meta.url)],
  ['node', ['node_modules/jest/bin/jest.js', '--runInBand', '--silent', '__tests__/rules/firestoreRules.test.ts', '__tests__/rules/storageRules.test.ts'], new URL('../../mobile-app/', import.meta.url)],
]) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
