// KV-COUNTRIES v2
// Buyers can join from these countries. Sellers must be in SELLER_COUNTRY.
export const COUNTRIES = [
  ['Nigeria', 'NG'], ['Ghana', 'GH'], ['Kenya', 'KE'], ['South Africa', 'ZA'],
  ["C\u00f4te d'Ivoire", 'CI'],
];

export const SELLER_COUNTRY = 'Nigeria';

export const flag = (code) =>
  String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));