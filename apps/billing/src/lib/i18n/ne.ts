/**
 * Nepali dictionary for the billing SPA — shell + common strings only.
 * Page-level translation is M5. Missing keys fall back to English
 * via the useT() hook.
 *
 * Convention: Devanagari where natural; technical terms (FY, AD, BS,
 * VAT, Rs.) stay as-is. Input labels stay English in the DB — only
 * display strings translate.
 */

export const ne = {
  // ── Shell / nav ──
  nav: {
    dashboard: 'डैशबोर्ड',
    bookkeeping: 'लेखापरिकलन',
    transactionEntry: 'लेनदेन प्रवेश',
    journal: 'जर्नल',
    transfers: 'हस्तान्तरण',
    posting: 'पोस्ट गर्नु',
    daybook: 'दिन-पुस्तिका',
    operations: 'सञ्चालन',
    parties: 'पक्षहरू',
    members: 'सदस्यहरू',
    recurringBilling: 'दोहोर्यो बिलिंग',
    expenseClaims: 'खर्च दावी',
    inventory: 'इन्भेन्टरी',
    bankReconciliation: 'ब्याङ्क व्यवस्थापन',
    fixedAssets: 'स्थायी सम्पदा',
    masters: 'मास्टरहरू',
    accounts: 'खाताहरू',
    openingBalances: 'खुला शेषर',
    membershipTypes: 'सदस्यता प्रकार',
    reports: 'प्रतिवेदनहरू',
    trialBalance: 'परीक्षण शेषर',
    profitLoss: 'लाभ / हानि',
    balanceSheet: 'सन्तुलन पत्र',
    reportsHub: 'प्रतिवेदनहरू',
    admin: 'प्रशासन',
    auditLog: 'लेखा अभिलेख',
    dataManagement: 'डाटा व्यवस्थापन',
    approvals: 'अनुमतिहरू',
    logs: 'अभिलेखहरू',
    recentActivity: 'हालको गतिविधि',
    settings: 'सेटिङहरू',
    help: 'सहायता',
    guide: 'मार्गदर्शन',
  },

  // ── Header / chrome ──
  header: {
    email: 'साइन इन गरिएको',
    search: 'खोज्नुहोस् & शورتकटहरू',
    sync: 'अनुकूलन',
  },
  sidebar: {
    orgName: 'स्यस्यः धुकू',
    collapse: 'साइडबार संकुचित गर्नुहोस्',
    expand: 'साइडबार विस्तार गर्नुहोस्',
  },

  // ── Common actions ──
  common: {
    save: 'स्वीकृत गर्नु',
    cancel: 'रद्द गर्नु',
    delete: 'हटाउनु',
    edit: 'सम्पादन गर्नु',
    add: 'थप्नु',
    search: 'खोज्नु',
    close: 'बन्द गर्नु',
    confirm: 'पुष्टि गर्नु',
    refresh: 'नयाँ गर्नु',
    print: 'छप्नु',
    export: 'रपट्याइ',
    back: 'फेर्नु',
    next: 'अगाडि',
    done: 'सम्पन्न',
    view: 'हेर्नु',
    filter: 'फिल्टर',
    clear: 'खाली गर्नु',
    selectAll: 'सबै छान्नु',
    deselectAll: 'सबैको चयन हटाउनु',
  },

  // ── Status chips ──
  status: {
    draft: 'मसौदा',
    posted: 'पोस्ट भयो',
    void: 'रद्द',
    paid: 'तिरिनु भयो',
    unpaid: 'तिरिएको छैन',
    partial: 'आशिक रूपमा तिरिनु भयो',
    outstanding: 'अपरिक्षित',
    active: 'सक्रिय',
    closed: 'बन्द',
    pending: 'मात्र',
    approved: 'अनुमोदित',
    rejected: 'अस्वीकृत',
  },

  // ── Toast kinds ──
  toast: {
    success: 'सफलता',
    error: 'त्रुटि',
    warning: 'चेतावनी',
    info: 'जानकारी',
  },

  // ── Calendar / date ──
  cal: {
    calendar: 'क्यालेन्डर',
    type: 'क्यालेन्डर प्रकार',
    dateFormat: 'मिति ढाँचा',
    timeFormat: 'समय ढाँचा',
    ad: 'एडी',
    bs: 'बिस.',
    h12: '१२ घण्टा',
    h24: '२४ घण्टा',
    preview: 'अगामन हेर्दै',
  },

  // ── Empty states ──
  empty: {
    noData: 'अहिलेसम्म कुनै डाटा छैन',
    noFiscalYears: 'अहिलेसम्म कुनै वित्तिय वर्ष छैन। पहिलो अवधि सिर्जना गर्नुहोस् ।',
    noSeries: 'अहिलेसम्म कुनै क्रमांक शृंखला छैन। क्रमांक शृंखला थप्नुहोस् ।',
    noAccounts: 'अहिलेसम्म कुनै खाता छैन। आफ्नो पहिलो खाता थप्नुहोस् ।',
    noTransactions: 'अहिलेसम्म कुनै लेनदेन छैन।',
    loading: 'लोड गरिरहेको छ…',
  },

  // ── Buttons inside modals ──
  modal: {
    create: 'सिर्जना गर्नु',
    update: 'अपडेट गर्नु',
    saveChanges: 'परिवर्तनहरू स्वीकृत गर्नु',
    createYear: 'वर्ष सिर्जना गर्नु',
    addSeries: 'क्रमांक शृंखला थप्नु',
    editSeries: 'क्रमांक शृंखला सम्पादन गर्नु',
    addAccount: 'नयाँ खाता',
    duplicate: 'प्रतिलिपि',
  },

  // ── Confirmation ──
  confirm: {
    deleteSeries: 'क्रमांक शृंखला हटाउनु',
    deleteAccount: 'यो खाता हटाउनु?',
    resetSeries: '{key} लाई {value} मा रिसेट गर्नु? अर्को लेनदेन {next} प्रयोग गर्दछ ।',
    closeYear: 'वित्तिय वर्ष बन्द गर्नु',
    openYear: 'वित्तिय वर्ष खुला गर्नु',
    setWorking: 'कार्य वर्ष बनाउनु',
    closeYearLabel: 'वर्ष बन्द गर्नु',
    openYearLabel: 'वर्ष खुला गर्नु',
    setWorkingLabel: 'कार्य वर्ष बनाउनु',
  },

  // ── Messages ──
  msg: {
    saved: '✓ स्वीकृत',
    unsaved: 'अस्वीकृत परिवर्तनहरू',
    saving: 'स्वीकृत गरिरहेको छ…',
    loading: 'लोड गरिरहेको छ…',
    missingDocType: 'अनुपस्थित कागजात प्रकार',
    missingDocTypeDetail: 'शृंखलाको लागि कागजात प्रकार छान्नुहोस् ।',
    seriesCreated: 'क्रमांक शृंखला सिर्जना',
    seriesUpdated: 'क्रमांक शृंखला अपडेट',
    seriesDeleted: 'क्रमांक शृंखला हटाइयो',
    cannotDeleteSeries: 'हटाउन सकिन्छैन',
    cannotDeleteSeriesDetail: 'यो शृंखला प्रयोग गरेर पहिलै पोस्ट भएका कागजातहरू छन् ।',
    failedToCreate: 'सिर्जना गर्न विफल',
    failedToUpdate: 'अपडेट गर्न विफल',
    failedToDelete: 'हटाउन विफल',
    failedToSave: 'स्वीकृत गर्न विफल',
    failedToLoad: 'लोड गर्न विफल',
    setWorkingYear: 'कार्य वर्ष सेट',
    setWorkingYearDetail: '{label} अहिले सक्रिय वित्तिय वर्ष हो ।',
    yearClosed: 'वित्तिय वर्ष बन्द',
    yearClosedDetail: '{label} — अहिले प्रवेशहरू पढ्न मात्र हो ।',
    yearOpened: 'वित्तिय वर्ष खुला',
    yearOpenedDetail: '{label} — अहिले प्रवेशहरू सम्पादन गर्न सकिन्छ ।',
    missingDates: 'मितिहरू हरू',
    missingDatesDetail: 'शुरु मिति र अन्त मिति दुवै आवश्यक छ ।',
    cannotSetWorking: 'कार्य वर्ष सेट गर्न सकिन्छैन',
    cannotSetWorkingDetail: '{label} बन्द छ । कार्य वर्ष बनाउन केवल खुला वित्तिय वर्ष मात्र — पहिले यो खुला गर्नुहोस् ।',
  },

  // ── Settings card titles ──
  settings: {
    calendar: 'क्यालेन्डर',
    companyProfile: 'कम्पनी प्रोफाइल',
    fiscalSettings: 'वित्तिय सेटिङहरू',
    featureToggles: 'फिचर टगलहरू',
    defaultAccounts: 'डिफ जेट खाता',
    chartOfAccounts: 'खाताको चार्ट',
    numberSeries: 'क्रमांक शृंखला',
    language: 'भाषा / Language',
    account: 'खाता',
  },

  // ── Language card ──
  lang: {
    title: 'भाषा / Language',
    subtitle: 'इन्टरफेस भाषा छान्नुहोस्',
    english: 'English',
    nepali: 'नेपाली',
    current: 'वर्तमान',
  },

  // ── Section subtitles / hints ──
  hint: {
    company: 'नाम, PAN, सम्पर्क सेट गर्नुहोस् — इन्भोइसहरूमा देखिन्छ',
    dragReorder: 'क्रम बदल्न खींच्नुहोस्',
    dragReorderDetail: 'यी प्राथमिकताहरू लेनदेन पोस्ट गर्दा प्रयोग हुन्छन् । हराएको खाताले पोस्ट गर्न रोक्छ ।',
    fiscalYears: 'सक्रिय वर्षहरू सम्पादन गर्न सकिन्छ · बन्द वर्षहरू पढ्न मात्र · कार्य वर्षले लेनदेन क्रमांकन चलाउँछ ।',
    selectFy: 'शीर्षकमा वित्तिय वर्ष छान्दा लेनदेन, जर्नल र प्रतिवेदनहरू त्यो अवधिमा फिल्टर हुन्छन् । बन्द वर्ष भित्रको मिति भएका प्रवेशहरू सर्भरले रद्द गर्छ ।',
    series: 'क्रमांक शृंखलाले {example} जस्तो कागजात नम्बरहरू तोक्छ → {result} जस्तो। FY-श्रेणित शृंखलाहरू हरेक वित्तिय वर्ष रिसेट हुन्छन् । पोस्ट भएका कागजात भएका शृंखलाहरू हटाउन सकिन्छैन ।',
    seriesExample: 'बिक्री इन्भोइस',
    seriesResult: 'SI-2083-84-0001',
    bankRec: 'सक्रिय — साइडबारमा देखिन्छ',
    bankRecOff: 'असक्रिय — साइडबारबाट लुक्छ',
    simplifiedInvOn: 'Rs. मान भन्दा कम हरेक लागति VAT-सहित देखाउँछ',
    simplifiedInvOff: 'सधैं पूर्ण कर विवरण देखाउँछ',
    demoSeedOn: 'सक्रिय — सेटअप जादुगर र डाटा व्यवस्थापन ले डेमो डाटा थप्न सक्छ',
    demoSeedOff: 'असक्रिय — डेमो डाटा बीजन अस्वीकार गरिन्छ',
    fyStatusActive: 'सक्रिय',
    fyStatusClosed: 'बन्द',
    setWorking: 'कार्य वर्ष बनाउनु',
    showTutorial: 'टुटोरियल देख्नु',
    signOut: 'साइन आउट',
  },
} as const

export type NeNamespace = keyof typeof ne
export type NeKey<N extends NeNamespace> = keyof typeof ne[N]
