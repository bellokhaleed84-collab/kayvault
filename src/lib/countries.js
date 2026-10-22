export const COUNTRIES = [
  ['Algeria', 'DZ'], ['Angola', 'AO'], ['Benin', 'BJ'], ['Botswana', 'BW'],
  ['Burkina Faso', 'BF'], ['Burundi', 'BI'], ['Cabo Verde', 'CV'], ['Cameroon', 'CM'],
  ['Central African Republic', 'CF'], ['Chad', 'TD'], ['Comoros', 'KM'],
  ['Congo (Brazzaville)', 'CG'], ['Congo (DRC)', 'CD'], ["C\u00f4te d'Ivoire", 'CI'],
  ['Djibouti', 'DJ'], ['Egypt', 'EG'], ['Equatorial Guinea', 'GQ'], ['Eritrea', 'ER'],
  ['Eswatini', 'SZ'], ['Ethiopia', 'ET'], ['Gabon', 'GA'], ['Gambia', 'GM'],
  ['Ghana', 'GH'], ['Guinea', 'GN'], ['Guinea-Bissau', 'GW'], ['Kenya', 'KE'],
  ['Lesotho', 'LS'], ['Liberia', 'LR'], ['Libya', 'LY'], ['Madagascar', 'MG'],
  ['Malawi', 'MW'], ['Mali', 'ML'], ['Mauritania', 'MR'], ['Mauritius', 'MU'],
  ['Morocco', 'MA'], ['Mozambique', 'MZ'], ['Namibia', 'NA'], ['Niger', 'NE'],
  ['Nigeria', 'NG'], ['Rwanda', 'RW'], ['S\u00e3o Tom\u00e9 and Pr\u00edncipe', 'ST'],
  ['Senegal', 'SN'], ['Seychelles', 'SC'], ['Sierra Leone', 'SL'], ['Somalia', 'SO'],
  ['South Africa', 'ZA'], ['South Sudan', 'SS'], ['Sudan', 'SD'], ['Tanzania', 'TZ'],
  ['Togo', 'TG'], ['Tunisia', 'TN'], ['Uganda', 'UG'], ['Zambia', 'ZM'], ['Zimbabwe', 'ZW'],
];

export const flag = (code) =>
  String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));