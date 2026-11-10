// KV-TOTP v1: authenticator-app codes (RFC 6238, SHA-1, 30 second steps). No packages needed.
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Sellers paste keys with spaces, dashes or lower case. Make them one clean string.
export function normalizeSecret(s) {
  return String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
}

export function isValidSecret(s) {
  const n = normalizeSecret(s);
  return n.length >= 16 && n.length <= 128 && /^[A-Z2-7]+$/.test(n);
}

function decodeBase32(n) {
  let bits = 0;
  let val = 0;
  const out = [];
  for (const ch of n) {
    val = ((val << 5) | ALPHABET.indexOf(ch)) & 0xffffffff;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function codeAt(secret, ms = Date.now(), digits = 6) {
  const counter = Math.floor(ms / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', decodeBase32(normalizeSecret(secret))).update(msg).digest();
  const o = h[19] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

// The code to show right now, and how many seconds it stays valid
export function current(secret, ms = Date.now()) {
  return { code: codeAt(secret, ms), seconds_left: 30 - (Math.floor(ms / 1000) % 30) };
}