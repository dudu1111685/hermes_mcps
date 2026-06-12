#!/usr/bin/env node

// One-time interactive Telegram login. Two modes:
//   npm run telegram:login     — phone → code → (optional) 2FA password
//   npm run telegram:login:qr  — QR scan from the Telegram app (no code needed;
//                                use when login codes don't arrive)
// Saves the resulting StringSession into .env as TELEGRAM_SESSION.

import { chmod, readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Logger, LogLevel } from 'telegram/extensions/Logger.js';

const ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

/** Minimal .env parse — only used to pick up TELEGRAM_API_ID/HASH when not exported. */
async function envFileValue(key: string): Promise<string | undefined> {
  try {
    const content = await readFile(ENV_PATH, 'utf8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function upsertEnv(key: string, value: string): Promise<void> {
  let content = '';
  try {
    content = await readFile(ENV_PATH, 'utf8');
  } catch {
    /* new file */
  }
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, 'm').test(content)) {
    content = content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  } else {
    content += `${content && !content.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  await writeFile(ENV_PATH, content, { mode: 0o600 });
  // writeFile's mode only applies to newly created files — an existing .env
  // keeps its old permissions, and it now holds a full-account credential.
  await chmod(ENV_PATH, 0o600);
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const apiIdRaw =
    process.env.TELEGRAM_API_ID ??
    (await envFileValue('TELEGRAM_API_ID')) ??
    (await rl.question('TELEGRAM_API_ID (from https://my.telegram.org → API development tools): '));
  const apiHash =
    process.env.TELEGRAM_API_HASH ??
    (await envFileValue('TELEGRAM_API_HASH')) ??
    (await rl.question('TELEGRAM_API_HASH: '));
  const apiId = Number(apiIdRaw.trim());
  if (!apiId || !apiHash.trim()) {
    console.error('api_id/api_hash are required. Get them at https://my.telegram.org');
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash.trim(), {
    connectionRetries: 3,
    baseLogger: new Logger(LogLevel.ERROR),
  });

  if (process.argv.includes('--qr')) {
    // QR login: no code delivery involved. Phone app: Settings → Devices →
    // Link Desktop Device → scan. Token rotates ~every 30s; gramjs re-calls
    // the callback with a fresh one each time.
    const QR_PNG = '/tmp/telegram-login-qr.png';
    await client.connect();
    await client.signInUserWithQrCode(
      { apiId, apiHash: apiHash.trim() },
      {
        qrCode: async ({ token }) => {
          const url = `tg://login?token=${token.toString('base64url')}`;
          await QRCode.toFile(QR_PNG, url, { scale: 8 });
          const ascii = await QRCode.toString(url, { type: 'terminal', small: true });
          console.log('\nScan with the Telegram app: Settings → Devices → Link Desktop Device\n');
          console.log(ascii);
          console.log(`(QR also saved as image: ${QR_PNG})`);
        },
        password: () => rl.question('2FA password: '),
        onError: async (err) => {
          console.error('QR login error:', err.message);
          return false; // keep waiting for a successful scan
        },
      },
    );
  } else {
    await client.start({
      phoneNumber: () => rl.question('Phone number (international, e.g. +9725...): '),
      phoneCode: () => rl.question('Login code (sent to your Telegram app): '),
      password: () => rl.question('2FA password (empty if none): '),
      onError: async (err) => {
        console.error('Login error:', err.message);
        return false; // keep retrying prompts
      },
    });
  }

  const session = client.session.save() ?? '';
  const me = await client.getMe();
  console.log(`\n✔ Logged in as ${me.firstName ?? ''} ${me.lastName ?? ''} (@${me.username ?? '—'})`);

  await upsertEnv('TELEGRAM_API_ID', String(apiId));
  await upsertEnv('TELEGRAM_API_HASH', apiHash.trim());
  await upsertEnv('TELEGRAM_SESSION', session);
  console.log(`✔ Session saved to ${ENV_PATH} (TELEGRAM_SESSION)`);
  console.log('  Treat it like a password — it grants full account access.');
  console.log('  Add the same three variables to your MCP host config env.');

  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
