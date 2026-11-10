// Checks totp.js against the official RFC 6238 test numbers (8 digit, SHA-1). Prints PASS or FAIL for each.
import { codeAt, isValidSecret, current } from '../lib/totp.js';

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // the RFC test key "12345678901234567890"
const cases = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
];
let bad = 0;
for (const [t, want] of cases) {
  const got = codeAt(secret, t * 1000, 8);
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? 'PASS' : 'FAIL') + '  time ' + t + '  expected ' + want + '  got ' + got);
}
const lower = 'gezd gnbv-gy3t qojq gezd gnbv gy3t qojq';
const okNorm = isValidSecret(lower) && codeAt(lower, 59000, 8) === '94287082';
if (!okNorm) bad++;
console.log((okNorm ? 'PASS' : 'FAIL') + '  key typed with spaces, dashes and small letters');
const okBad = !isValidSecret('hello') && !isValidSecret('1234567890123456');
if (!okBad) bad++;
console.log((okBad ? 'PASS' : 'FAIL') + '  rejects bad keys');
const c = current(secret);
console.log('Right now: code ' + c.code + ', ' + c.seconds_left + ' seconds left');
console.log(bad === 0 ? 'ALL TESTS PASSED' : bad + ' TEST(S) FAILED');