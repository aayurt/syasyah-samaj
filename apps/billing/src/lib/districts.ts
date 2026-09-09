/**
 * 77 Nepal districts — flat list, Nepali (Devanagari) names.
 *
 * Used by the Members application form (citizenshipDistrict select).
 *
 * Source: https://en.wikipedia.org/wiki/Districts_of_Nepal
 * Province reorganization per 2015 constitution (7 provinces).
 */

export const DISTRICTS = [
  // ── Koshi (Province 1) — 14 ──
  { label: 'तापलेजुङ', value: 'taplejung' },
  { label: 'पाँचथर', value: 'panchthar' },
  { label: 'इलाम', value: 'ilam' },
  { label: 'झापा', value: 'jhapa' },
  { label: 'तेह्रथुम', value: 'tehrathum' },
  { label: 'संखुवासभा', value: 'sankhuwasabha' },
  { label: 'भोजपुर', value: 'bhojpur' },
  { label: 'सोलुखुम्बु', value: 'solukhumbu' },
  { label: 'ओखलढुङ्गा', value: 'okhaldhunga' },
  { label: 'खोटाङ', value: 'khotang' },
  { label: 'धनकुटा', value: 'dhankuta' },
  { label: 'उदयपुर', value: 'udayapur' },
  { label: 'सप्तरी', value: 'saptari' },
  { label: 'मोरङ', value: 'morang' },

  // ── Madhesh (Province 2) — 8 ──
  { label: 'सिराहा', value: 'siraha' },
  { label: 'धनुषा', value: 'dhanusha' },
  { label: 'महोत्तरी', value: 'mahottari' },
  { label: 'सर्लाही', value: 'sarlahi' },
  { label: 'रौतहट', value: 'rautahat' },
  { label: 'बरा', value: 'bara' },
  { label: 'पर्सा', value: 'parsa' },
  { label: 'सिन्धुपाल्चोक', value: 'sindhupalchok' },

  // ── Bagmati (Province 3) — 13 ──
  { label: 'काभ्रेपलाञ्चोक', value: 'kabhre-palanchowk' },
  { label: 'सिन्धुली', value: 'sindhuli' },
  { label: 'रामेछप', value: 'ramechhap' },
  { label: 'दोलखा', value: 'dolakha' },
  { label: 'भक्तपुर', value: 'bhaktapur' },
  { label: 'काठमाडौं', value: 'kathmandu' },
  { label: 'ललितपुर', value: 'lalitpur' },
  { label: 'नुवाकोट', value: 'nuwakot' },
  { label: 'रसुवा', value: 'rasuwa' },
  { label: 'धादिङ', value: 'dhading' },
  { label: 'मकवानपुर', value: 'makwanpur' },
  { label: 'चितवन', value: 'chitwan' },
  { label: 'गोरखा', value: 'gorkha' },

  // ── Gandaki (Province 4) — 11 ──
  { label: 'मनाङ', value: 'manang' },
  { label: 'मुस्ताङ', value: 'mustang' },
  { label: 'कास्की', value: 'kaski' },
  { label: 'लमजुङ', value: 'lamjung' },
  { label: 'तनहुँ', value: 'tanahu' },
  { label: 'म्याग्दी', value: 'myagdi' },
  { label: 'बागलुङ', value: 'baglung' },
  { label: 'पर्वत', value: 'parbat' },
  { label: 'स्याङ्जा', value: 'syangja' },
  { label: 'नवलपरासी (पूर्वी)', value: 'nawalparasi-east' },
  { label: 'नवलपरासी (पश्चिमी)', value: 'nawalparasi-west' },

  // ── Lumbini (Province 5) — 12 ──
  { label: 'कपिलवस्तु', value: 'kapilvastu' },
  { label: 'रूपन्देही', value: 'rupandehi' },
  { label: 'पाल्पा', value: 'palpa' },
  { label: 'गुल्मी', value: 'gulmi' },
  { label: 'आर्घाखाँची', value: 'arghakhanchi' },
  { label: 'बाँके', value: 'banke' },
  { label: 'बर्दिया', value: 'bardiya' },
  { label: 'रोल्पा', value: 'rolpa' },
  { label: 'प्युठान', value: 'pyuthan' },
  { label: 'दाङ', value: 'dang' },
  { label: 'रूकुम पूर्व', value: 'rukum-east' },
  { label: 'रूकुम पश्चिम', value: 'rukum-west' },

  // ── Karnali (Province 6) — 10 ──
  { label: 'सुर्खेत', value: 'surkhet' },
  { label: 'दैलेख', value: 'dailekh' },
  { label: 'जुम्ला', value: 'jumla' },
  { label: 'कलिकोट', value: 'kalikot' },
  { label: 'मुगु', value: 'mugu' },
  { label: 'हुम्ला', value: 'humla' },
  { label: 'सल्यान', value: 'salyan' },
  { label: 'जुन्गढ', value: 'jajarkot' },
  { label: 'दोल्पा', value: 'dolpa' },
  { label: 'हुम्ला', value: 'humla-2' },

  // ── Sudurpashchim (Province 7) — 9 ──
  { label: 'कैलाली', value: 'kailali' },
  { label: 'कञ्चनपुर', value: 'kanchanpur' },
  { label: 'डडेलधुरा', value: 'dadeldhura' },
  { label: 'बैतडी', value: 'baitadi' },
  { label: 'दार्चुला', value: 'darchula' },
  { label: 'अछाम', value: 'achham' },
  { label: 'डोटी', value: 'doti' },
  { label: 'बाजुरा', value: 'bajura' },
  { label: 'बाजहाङ', value: 'bajhang' },
] as const
