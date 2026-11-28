/**
 * Bikram Sambat (BS) / Nepali Date Utilities
 * 
 * Bikram Sambat calendar starts in mid-April (Baisakh 1 ~ April 14).
 * BS year = Gregorian year - 56, but with month/day adjustments 
 * because BS new year starts in mid-April.
 * 
 * For example:
 * - April 14, 2026 (Gregorian) = Baisakh 1, 2083 (BS)
 * - January 1, 2026 (Gregorian) = December 17, 2082 (BS) [still in previous BS year]
 */

export interface BSDate {
  year: number;
  month: number; // 1-12 (Baisakh to Chaitra)
  day: number;
}

export interface ADDate {
  year: number;
  month: number; // 0-11 (JavaScript Date month)
  day: number;
}

/**
 * Converts a Gregorian (AD) date to Bikram Sambat (BS) date
 * @param year Gregorian year (e.g., 2026)
 * @param month JavaScript month (0-11, 0 = January)
 * @param day Day of month (1-31)
 * @returns BS date object with year (BS year), month (1-12), and day
 */
export function adToBs(year: number, month: number, day: number): BSDate {
  // BS new year starts in mid-April (around April 14)
  // So for months January-March (0-2), we need to subtract 1 from the BS year
  // because those months belong to the previous BS year
  
  let bsYear: number;
  let bsMonth: number; // 1-12
  let bsDay: number = day;

  if (month >= 3) { // April (3) through December (11)
    // These months are in the current BS year
    bsYear = year - 56;
    // BS months: 1=Baisakh, 2=Jestha, 3=Ashadh, 4=Shrawan, 5=Bhadra, 6=Ashwin,
    // 7=Kartik, 8=Mangsir, 9=Poush, 10=Magh, 11=Falgun, 12=Chaitra
    const monthMap: { [key: number]: number } = {
      3: 1,   // April -> Baisakh
      4: 2,   // May -> Jestha
      5: 3,   // June -> Ashadh
      6: 4,   // July -> Shrawan
      7: 5,   // August -> Bhadra
      8: 6,   // September -> Ashwin
      9: 7,   // October -> Kartik
      10: 8,  // November -> Mangsir
      11: 9,  // December -> Poush
      0: 10,  // January -> Magh (next year's cycle)
      1: 11,  // February -> Falgun
      2: 12,  // March -> Chaitra
    };
    bsMonth = monthMap[month] || 1;
  } else {
    // January (0) or February (1) - these are in the previous BS year
    bsYear = year - 57;
    const monthMap: { [key: number]: number } = {
      3: 1,   // April -> Baisakh
      4: 2,   // May -> Jestha
      5: 3,   // June -> Ashadh
      6: 4,   // July -> Shrawan
      7: 5,   // August -> Bhadra
      8: 6,   // September -> Ashwin
      9: 7,   // October -> Kartik
      10: 8,  // November -> Mangsir
      11: 9,  // December -> Poush
      0: 10,  // January -> Magh
      1: 11,  // February -> Falgun
      2: 12,  // March -> Chaitra
    };
    bsMonth = monthMap[month] || 1;
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Converts a Bikram Sambat (BS) date to Gregorian (AD) date
 * @param bsYear BS year (e.g., 2083)
 * @param bsMonth BS month (1-12, 1=Baisakh, 12=Chaitra)
 * @param bsDay Day of month (1-31)
 * @returns AD date object with year, month (0-11), and day
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): ADDate {
  // BS new year starts in Baisakh (month 1), which is approximately April 14
  // For months Baisakh-Chaitra (1-12), we add 56 to get Gregorian year
  // But need to adjust for the fact that BS new year is in mid-April
  
  let adYear: number;
  let adMonth: number; // 0-11 JavaScript month
  let adDay: number = bsDay;

  const monthMap: { [key: number]: number } = {
    1: 3,   // Baisakh -> April
    2: 4,   // Jestha -> May
    3: 5,   // Ashadh -> June
    4: 6,   // Shrawan -> July
    5: 7,   // Bhadra -> August
    6: 8,   // Ashwin -> September
    7: 9,   // Kartik -> October
    8: 10,  // Mangsir -> November
    9: 11,  // Poush -> December
    10: 0,  // Magh -> January (next year)
    11: 1,  // Falgun -> February
    12: 2,  // Chaitra -> March
  };

  adMonth = monthMap[bsMonth] || 3;
  
  adYear = bsYear + 56;

  return { year: adYear, month: adMonth, day: adDay };
}

/**
 * Converts a JavaScript Date to Bikram Sambat (BS) date
 * @param date JavaScript Date object
 * @returns BS date object
 */
export function dateToBs(date: Date): BSDate {
  return adToBs(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Converts a Bikram Sambat (BS) date to a JavaScript Date
 * @param bsDate BS date object with year, month (1-12), and day
 * @returns JavaScript Date object
 */
export function bsToDate(bsDate: BSDate): Date {
  const adDate = bsToAd(bsDate.year, bsDate.month, bsDate.day);
  // Create date with day 1 of the target month, then set to the correct day
  const result = new Date(adDate.year, adDate.month, 1);
  result.setDate(bsDate.day);
  return result;
}

/**
 * Formats a BS date as a string (e.g., "2083-01-15")
 * @param bsDate BS date object
 * @returns formatted string
 */
export function formatBsDate(bsDate: BSDate): string {
  return `${bsDate.year}-${bsDate.month.toString().padStart(2, '0')}-${bsDate.day.toString().padStart(2, '0')}`;
}

/**
 * Parses a BS date string (e.g., "2083-01-15") into a BSDate object
 * @param bsDateStr BS date string in YYYY-MM-DD format
 * @returns BSDate object
 */
export function parseBsDate(bsDateStr: string): BSDate | null {
  const match = bsDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  return { year, month, day };
}

/**
 * Gets the Nepali month name for a BS month number
 * @param month BS month (1-12)
 * @returns Nepali month name
 */
export function getNepaliMonthName(month: number): string {
  const months = [
    "बैशाख", "जेठ", "आषाढ", "श्रावण",
    "भाद्र", "आशिन", "कार्तिक", "मंसिर",
    "पौष", "माघ", "फाल्गुन", "चैत्र"
  ];
  return months[month - 1] || "अज्ञात";
}

/**
 * Gets the English month name for a BS month number
 * @param month BS month (1-12)
 * @returns English month name
 */
export function getEnglishMonthName(month: number): string {
  const months = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan",
    "Bhadra", "Ashwin", "Kartik", "Mangsir",
    "Poush", "Magh", "Falgun", "Chaitra"
  ];
  return months[month - 1] || "Unknown";
}