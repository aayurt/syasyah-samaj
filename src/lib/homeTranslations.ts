export type Locale = 'en' | 'ne' | 'new'

export interface EventItem {
  month: string
  day: string
  title: string
  type: string
  location: string
  image: string
}

export interface ArchiveItem {
  id: string
  category: 'manuscript' | 'photo' | 'guthi' | 'general'
  tag: string
  title: string
  era: string
  source: string
  description: string
  image: string
}

export interface ElderItem {
  name: string
  honorificTitle: string
  field: string
  bio: string
  initial: string
  image: string
}

export interface DonorItem {
  id: string
  name: string
  group: string
  ilaka: string
  phone: string
}

export const homeContent = {
  en: {
    hero: {
      badge: 'Established 1999 AD (2056 BS) • Lalitpur, Nepal',
      headline: 'Heritage, Civic Service & Guthi Solidarity',
      description:
        'The central community portal for Syasyah Samaj in Yala (Lalitpur). Coordinating 24 local Ilakas, digital archives, emergency blood donors, and modern membership services.',
      actionPrimary: 'Citizen & Member Login →',
      actionSecondary: 'Explore 24 Ilakas',
      actionBilling: 'Accounting Dhuku (/app)',
    },
    metrics: {
      ilakasNum: '24',
      ilakasLabel: 'Active Ilakas',
      ilakasSub: 'Yala municipal sectors',
      familiesNum: '1,842',
      familiesLabel: 'Registered Families',
      familiesSub: '98% digitally verified',
      archivesNum: '120+',
      archivesLabel: 'Preserved Archives',
      archivesSub: 'Deeds & Guthi by-laws',
      donorsNum: '210+',
      donorsLabel: 'Emergency Donors',
      donorsSub: '24/7 on-call registry',
    },
    events: {
      title: 'Upcoming Gatherings & Cultural Events',
      subtitle: 'Central General Assemblies, Guthi rituals, and community coordination in Yala',
      badgeCentral: 'Central',
      badgeCultural: 'Cultural',
      badgeHealth: 'Health Camp',
      agendaBtn: 'View Agenda',
      routeBtn: 'Procession Map',
      rsvpBtn: 'RSVP / Register',
      items: [
        {
          month: 'OCT',
          day: '10',
          title: '24th Annual General Assembly & Scholarship Awards',
          type: 'Central Assembly',
          location: 'Syasyah Samaj Bhavan, Mangal Bazaar • 11:00 AM',
          image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'OCT',
          day: '15',
          title: 'Yenya (Indra Jatra) Samay Baji & Musical Procession',
          type: 'Cultural Festival',
          location: 'Patan Durbar Square • 2:00 PM',
          image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'NOV',
          day: '02',
          title: 'Community Open Blood Donation & Senior Health Camp',
          type: 'Health Camp',
          location: 'Pulchowk Coordination Center • 8:00 AM - 2:00 PM',
          image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    services: {
      badge: 'Citizen Charter',
      title: 'Online Citizen Services & Status Tracker',
      subtitle: 'Enter your application reference to check approval or ID card issuance status',
      placeholder: 'Application No. (e.g. SS-2083-492)',
      checkBtn: 'Check Status',
      sampleResult: 'Application #SS-2083-492 — Recommended by Mangal Bazaar Ilaka Coordinator. Digital ID issuance in progress.',
      links: {
        digitalId: '🪪 Digital Member ID & Dues Renewal',
        scholarship: '🎓 Higher Education Scholarship Application',
        hallBooking: '🏛️ Community Hall & Feast Booking (25% Member Discount)',
        billing: '💼 Syasyah Dhuku Accounting & Billing SPA (/app)',
      },
    },
    blood: {
      title: '24/7 Emergency Blood Donor Network',
      subtitle: 'Connect with community donors across Lalitpur during medical emergencies',
      hours: '24/7 Available',
      allGroups: 'All Groups',
      callBtn: 'Call',
      donors: [
        { id: '1', name: 'Amit Shrestha', group: 'O+', ilaka: 'Mangal Bazaar', phone: '9841-012345' },
        { id: '2', name: 'Pramila Shrestha', group: 'A+', ilaka: 'Pulchowk', phone: '9851-234567' },
        { id: '3', name: 'Sanjay Man Shrestha', group: 'B+', ilaka: 'Tyagal', phone: '9801-987654' },
        { id: '4', name: 'Roshan Shrestha', group: 'AB+', ilaka: 'Chyasal', phone: '9841-556677' },
        { id: '5', name: 'Sushil Shrestha', group: 'O+', ilaka: 'Patan Dhoka', phone: '9851-443322' },
      ],
    },
    timeline: {
      badge: 'Historical Milestones',
      title: 'Timeline: Four Decades of Community Building',
      subtitle: 'From formal incorporation in 1999 AD to modern digital public administration',
      milestones: [
        {
          year: '1999 AD (2056 BS)',
          title: 'Formal Incorporation of Samaj',
          tag: 'Foundation',
          description: 'Elders from various toles of Patan convened to establish the formal constitution and registered body (Reg No: 234/056/57).',
        },
        {
          year: '2005 AD (2062 BS)',
          title: 'Decentralization into 24 Ilakas',
          tag: 'Decentralization',
          description: 'Lalitpur municipal area was organized into 24 neighborhood Ilakas with dedicated coordinators to manage local welfare.',
        },
        {
          year: '2015 AD (2072 BS)',
          title: 'Earthquake Relief & Reconstruction',
          tag: 'Disaster Relief',
          description: 'Immediate shelter, emergency food aid, and architectural heritage salvage for impacted families across historical Lalitpur.',
        },
        {
          year: '2024-26 AD (2080-83 BS)',
          title: 'Digital Governance & Accounting',
          tag: 'Digital Era',
          description: 'Launch of offline-first accounting (Syasyah Dhuku), digital member identity cards, and digitized manuscript archives.',
        },
      ],
    },
    archives: {
      badge: 'Heritage Repository',
      title: 'Digital Archives: Historical Deeds & Manuscripts',
      subtitle: 'Ancient Guthi agreements, photographic records, and traditional Newar codes of conduct',
      tabAll: 'All Archives',
      tabManuscript: 'Manuscripts & Deeds',
      tabPhoto: 'Historical Photos',
      tabGuthi: 'Guthi Regulations',
      readMore: 'Read Document →',
      viewPhoto: 'View Photo →',
      closeBtn: 'Close',
      downloadPdf: 'Download Scan (PDF)',
      items: [
        {
          id: '1',
          category: 'manuscript' as const,
          tag: 'Historical Deed',
          title: 'Patan Taleju Guthi Festival Administration Agreement',
          era: 'Nepal Samvat 1048 (1927 AD)',
          source: 'Kwache Guthi Archives',
          description: 'Ancient contract penned in Prachalit Newari script stipulating annual festival offerings and Samay Baji distribution responsibilities.',
          image: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '2',
          category: 'photo' as const,
          tag: 'Archival Photograph',
          title: 'Mangal Bazaar & Chyasal Gunla Baja Musical Troupe',
          era: '1967 AD (2024 BS)',
          source: 'Chyasal Archives',
          description: 'Historic monochrome capture of over 60 musicians playing traditional Dhaa, Bhusya, and bansuri flutes during holy Gunla procession.',
          image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '3',
          category: 'guthi' as const,
          tag: 'Guthi By-laws',
          title: 'Traditional Code of Conduct for See & Sanah Guthees',
          era: 'Updated 2024 AD',
          source: 'Central Secretariat',
          description: 'Codified principles governing funeral assistance, mutual welfare funds, and rotating religious obligations among family branches.',
          image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    elders: {
      badge: 'Living Heritage',
      title: 'Distinguished Elders & Guardians of Heritage',
      subtitle: 'Honoring scholars, cultural masters, and pioneers who dedicated their lives to language, music, and community harmony',
      honorRoll: 'Community Hall of Honor',
      elders: [
        {
          name: 'Late Purna Man Shrestha',
          honorificTitle: 'Founding Advisor',
          field: 'Historian & Cultural Scholar',
          bio: 'Five decades of pioneering field research on Newar genealogy, ancient manuscripts, and Patan’s medieval social structures.',
          initial: 'P',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'Shri Satya Narayan Shrestha',
          honorificTitle: 'Senior Guthi Guru',
          field: 'Classical Dhapha & Charya Instructor (84 yrs)',
          bio: 'Preserved classical ragas and trained four generations of youth in traditional percussion and ritual flute at Chyasal and Mangal Bazaar.',
          initial: 'S',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'Smt. Chandra Lakshmi Shrestha',
          honorificTitle: 'Community Activist',
          field: 'Women Empowerment & Micro-Savings Pioneer',
          bio: 'Founded cooperative women groups across Lalitpur to achieve household economic independence and culinary heritage enterprise.',
          initial: 'C',
          image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
        },
      ],
    },
  },
  ne: {
    hero: {
      badge: 'स्थापना वि.सं. २०५६ • यल (ललितपुर), नेपाल',
      headline: 'संस्कृति, नागरिक सेवा र गुठी ऐक्यबद्धता',
      description:
        'ललितपुरका श्रेष्ठ (स्यस्यः) समुदायको केन्द्रीय संस्थागत पोर्टल। २४ इलाका, परम्परागत गुठी अभिलेख, आपतकालीन रक्तदाता सञ्जाल र आधुनिक नागरिक सेवा।',
      actionPrimary: 'नागरिक तथा सदस्य लगइन →',
      actionSecondary: '२४ इलाका अन्वेषण',
      actionBilling: 'लेखा धुकू प्रणाली (/app)',
    },
    metrics: {
      ilakasNum: '२४',
      ilakasLabel: 'सक्रिय इलाकाहरू',
      ilakasSub: 'यल नगर तथा उपनगर क्षेत्र',
      familiesNum: '१,८४२',
      familiesLabel: 'दर्ता सदस्य परिवार',
      familiesSub: '९८% डिजिटल प्रमाणीकरण सम्पन्न',
      archivesNum: '१२०+',
      archivesLabel: 'संरक्षित पाण्डुलिपि तथा अभिलेख',
      archivesSub: 'ऐतिहासिक तमसुक र विधान',
      donorsNum: '२१०+',
      donorsLabel: 'आपतकालीन रक्तदाता',
      donorsSub: '२४ सै घण्टा उपलब्ध सञ्जाल',
    },
    events: {
      title: 'आसन्न गुठी, पर्व तथा कार्यक्रमहरू',
      subtitle: 'केन्द्रीय साधारण सभा, सांस्कृतिक झाँकी र सामुदायिक भेला विवरण',
      badgeCentral: 'केन्द्रीय सभा',
      badgeCultural: 'सांस्कृतिक पर्व',
      badgeHealth: 'स्वास्थ्य शिविर',
      agendaBtn: 'कार्यसूची हेर्नुहोस्',
      routeBtn: 'मार्ग नक्शा',
      rsvpBtn: 'सहभागिता दर्ता',
      items: [
        {
          month: 'असोज',
          day: '१०',
          title: '२४ औं वार्षिक साधारण सभा तथा छात्रवृत्ति वितरण',
          type: 'केन्द्रीय सभा',
          location: 'स्यस्यः समाज भवन, मंगलबजार • बिहान ११:०० बजे',
          image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'असोज',
          day: '१५',
          title: 'यँयाः (इन्द्रजात्रा) समय् बजि वितरण तथा सांस्कृतिक परिक्रमा',
          type: 'सांस्कृतिक पर्व',
          location: 'पाटन दरवार परिसर • दिउँसो २:०० बजे',
          image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'कात्तिक',
          day: '०२',
          title: 'सामुदायिक खुला रक्तदान तथा स्वास्थ्य परीक्षण शिविर',
          type: 'स्वास्थ्य शिविर',
          location: 'पुल्चोक इलाका समन्वय केन्द्र • बिहान ८:०० - २:०० सम्म',
          image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    services: {
      badge: 'नागरिक सेवा बडापत्र',
      title: 'अनलाइन नागरिक सेवा तथा स्थिति ट्र्याकर',
      subtitle: 'आवेदन दर्ता नम्बर प्रविष्ट गरी आफ्नो सिफारिस वा परिचयपत्रको स्थिति जाँच्नुहोस्',
      placeholder: 'आवेदन नं. (उदा. SS-2083-492)',
      checkBtn: 'स्थिति जाँच',
      sampleResult: 'आवेदन #SS-2083-492 — सम्बन्धित इलाका संयोजकबाट सिफारिस प्राप्त भएको छ। डिजिटल परिचयपत्र जारी हुने क्रममा छ।',
      links: {
        digitalId: '🪪 डिजिटल परिचयपत्र तथा शुल्क नविकरण',
        scholarship: '🎓 जेहेन्दार छात्रवृत्ति आवेदन फारम',
        hallBooking: '🏛️ सामुदायिक भवन तथा भोज हल बुकिङ (२५% छुट)',
        billing: '💼 स्यस्यः धुकू लेखा तथा बिलिङ प्रणाली (/app)',
      },
    },
    blood: {
      title: 'रक्त समूह आपतकालीन सञ्जाल',
      subtitle: 'समुदायमा आकस्मिक रगतको आवश्यकता पर्दा तत्काल सम्पर्क गर्नुहोस्',
      hours: '२४ सै घण्टा सेवा',
      allGroups: 'सबै समूह',
      callBtn: 'सम्पर्क',
      donors: [
        { id: '1', name: 'अमित श्रेष्ठ', group: 'O+', ilaka: 'मंगलबजार', phone: '९८४१-०१२३४५' },
        { id: '2', name: 'प्रमिला श्रेष्ठ', group: 'A+', ilaka: 'पुल्चोक', phone: '९८५१-२३४५६७' },
        { id: '3', name: 'सञ्जय मान श्रेष्ठ', group: 'B+', ilaka: 'त्यागल', phone: '९८०१-९८७६५४' },
        { id: '4', name: 'रोशन श्रेष्ठ', group: 'AB+', ilaka: 'च्यासल', phone: '९८४१-५५६६७७' },
        { id: '5', name: 'सुशील श्रेष्ठ', group: 'O+', ilaka: 'पाटनढोका', phone: '९८५१-४४३३२२' },
      ],
    },
    timeline: {
      badge: 'ऐतिहासिक यात्रा',
      title: 'कालक्रम: समाज निर्माणका ऐतिहासिक कोशेढुङ्गाहरू',
      subtitle: 'वि.सं. २०५६ को स्थापनादेखि आधुनिक डिजिटल सुशासनसम्मको गौरवमय चार दशक',
      milestones: [
        {
          year: '२०५६ वि.सं. (1999 AD)',
          title: 'समाजको औपचारिक स्थापना',
          tag: 'स्थापना वर्ष',
          description: 'पाटनका विभिन्न टोलका श्रेष्ठ अग्रजहरूको भेलाद्वारा स्यस्यः समाजको गठन र विधान दर्ता (दर्ता नं: २३४/०५६/५७)।',
        },
        {
          year: '२०६२ वि.सं. (2005 AD)',
          title: '२४ इलाका संरचना घोषणा',
          tag: 'विकेन्द्रीकरण',
          description: 'ललितपुर नगरलाई प्रशासनिक तथा सामाजिक सहजताका लागि २४ इलाकामा विभाजन गरी स्थानीय संयोजक नियुक्ति।',
        },
        {
          year: '२०७२ वि.सं. (2015 AD)',
          title: 'महाभूकम्प राहत तथा पुनर्निर्माण',
          tag: 'विपद् उद्धार',
          description: 'पाटनका भूकम्प प्रभावित परिवारलाई आपतकालीन आश्रय, खाद्यान्न वितरण, सम्पदा संरक्षण र अक्षयकोष परिचालन।',
        },
        {
          year: '२०८०-८३ वि.सं. (2024-26 AD)',
          title: 'डिजिटल अभिलेखीकरण र लेखा',
          tag: 'डिजिटल युग',
          description: 'अफलाइन-फर्स्ट लेखा प्रणाली (स्यस्यः धुकू), डिजिटल सदस्यता कार्ड तथा ऐतिहासिक पाण्डुलिपि संरक्षण।',
        },
      ],
    },
    archives: {
      badge: 'ऐतिहासिक सम्पदा',
      title: 'डिजिटल संग्रह: सामुदायिक अभिलेख तथा पाण्डुलिपि',
      subtitle: 'पाटनका प्राचीन गुठी तमसुक, रीतिथिति निर्णय, पाण्डुलिपि र दुर्लभ ऐतिहासिक तस्बिरहरू',
      tabAll: 'सबै संग्रह',
      tabManuscript: 'तमसुक तथा पाण्डुलिपि',
      tabPhoto: 'ऐतिहासिक तस्बिर',
      tabGuthi: 'गुठी विधान',
      readMore: 'अध्ययन गर्नुहोस् →',
      viewPhoto: 'तस्बिर हेर्नुहोस् →',
      closeBtn: 'बन्द गर्नुहोस्',
      downloadPdf: 'डाउनलोड (PDF)',
      items: [
        {
          id: '1',
          category: 'manuscript' as const,
          tag: 'ऐतिहासिक पाण्डुलिपि',
          title: 'पाटन तलेजु गुठी व्यवस्थापन सम्बन्धी प्राचीन निर्णय',
          era: 'नेपाल संवत् १०४८ (वि.सं. १९८४)',
          source: 'क्वाछें गुठी अभिलेख',
          description: 'नेवारी लिपिमा लेखिएको ऐतिहासिक तमसुक जसमा स्यस्यः समुदायको तलेजु मन्दिरमा वार्षिक पर्व पूजा तथा समय् बजि वितरण दायित्व किटान गरिएको छ।',
          image: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '2',
          category: 'photo' as const,
          tag: 'तस्बिर अभिलेख',
          title: 'मंगलबजार तथा च्यासल गुँला बाजा खलः (वि.सं. २०२४)',
          era: 'वि.सं. २०२४',
          source: 'च्यासल अभिलेख',
          description: 'परम्परागत धाः बाजा, भुस्याः र बाँसुरी बजाउँदै पाटनका ऐतिहासिक बहाः बही परिक्रमा गर्दा खिचिएको श्यामश्वेत ऐतिहासिक तस्बिर।',
          image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '3',
          category: 'guthi' as const,
          tag: 'गुठी आचारसंहिता',
          title: 'सी गुठी तथा सनः गुठी परम्परागत आचारसंहिता',
          era: 'अद्यावधिक वि.सं. २०८१',
          source: 'केन्द्रीय सचिवालय',
          description: 'मृत्यु संस्कार, दाहसंस्कार सहयोग र सदस्यहरू बीचको आपसी सद्भाव कायम राख्न तयार गरिएको नियम संग्रह।',
          image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    elders: {
      badge: 'धरोहर व्यक्तित्व',
      title: 'आदरणीय अग्रज: समाजका विशिष्ट धरोहर व्यक्तित्वहरू',
      subtitle: 'भाषा, संस्कृति, गुठी व्यवस्थापन र सामाजिक जागरणमा अमूल्य योगदान पुर्याउने सम्मानित महानुभावहरू',
      honorRoll: 'सामुदायिक सम्मान सूची',
      elders: [
        {
          name: 'स्व. पूर्णमान श्रेष्ठ',
          honorificTitle: 'संस्थापक सल्लाहकार',
          field: 'इतिहासविद् तथा संस्कृतिविद्',
          bio: 'पाटनको स्यस्यः इतिहास, नेवार जातिको उत्पत्ति र पाण्डुलिपि अन्वेषणमा ५ दशक लामो शोध र ग्रन्थ प्रकाशन।',
          initial: 'प',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'श्री सत्यनारायण श्रेष्ठ',
          honorificTitle: 'वरिष्ठ गुठी गुरु',
          field: 'दाफा भजन तथा राग प्रशिक्षक (८४ वर्ष)',
          bio: 'च्यासल र मंगलबजारमा चार पुस्तालाई शास्त्रीय दाफा भजन, चर्या नृत्य र परम्परागत बाँसुरी वादन प्रशिक्षण।',
          initial: 'स',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'श्रीमती चन्द्रलक्ष्मी श्रेष्ठ',
          honorificTitle: 'सामुदायिक अभियन्ता',
          field: 'महिला जागरण तथा बचत कोष अग्रणी',
          bio: 'पाटनका विभिन्न टोलमा महिला समूह गठन, परम्परागत नेवारी व्यञ्जन उत्पादन र आत्मनिर्भरता अभियानका नेतृत्वकर्ता।',
          initial: 'च',
          image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
        },
      ],
    },
  },
  new: {
    hero: {
      badge: 'पलिस्था ने.सं. १११९ • यल, नेपाः',
      headline: 'संस्कृति, नागरिक सेवा व गुथि एकता',
      description:
        'यलया स्यस्यः समुदायया केन्द्रीय संस्थागत पोर्टल। २४ गू इलाका, परम्परागत गुथि अभिलेख, आकस्मिक हिदाता सञ्जाल व आधुनिक नागरिक सेवा।',
      actionPrimary: 'नागरिक व दुजः लगइन →',
      actionSecondary: '२४ गू इलाका स्वयेगु',
      actionBilling: 'लेखा धुकू (/app)',
    },
    metrics: {
      ilakasNum: '२४',
      ilakasLabel: 'सक्रिय इलाकापिं',
      ilakasSub: 'यल नगर व लागा क्षेत्र',
      familiesNum: '१,८४२',
      familiesLabel: 'दर्ता दुजः परिवार',
      familiesSub: '९८% डिजिटल प्रमाणीकरण सिधल',
      archivesNum: '१२०+',
      archivesLabel: 'सुरक्षित पाण्डुलिपि व अभिलेख',
      archivesSub: 'पुलांगु तमसुक व विधान',
      donorsNum: '२१०+',
      donorsLabel: 'आकस्मिक हिदातापिं',
      donorsSub: '२४ सै घण्टा उपलब्ध सञ्जाल',
    },
    events: {
      title: 'आसन्न गुथि, नखःचखः व ज्याझ्वः',
      subtitle: 'केन्द्रीय मुँज्या, सांस्कृतिक झाँकी व समुदायया मुना विवरण',
      badgeCentral: 'केन्द्रीय मुँज्या',
      badgeCultural: 'सांस्कृतिक नखः',
      badgeHealth: 'उसाँय् शिविर',
      agendaBtn: 'कार्यसूची',
      routeBtn: 'चाःहिलेगु लँपु',
      rsvpBtn: 'उपस्थिति दर्ता',
      items: [
        {
          month: 'कौला',
          day: '१०',
          title: '२४ क्वःगु वार्षिक मुँज्या व छात्रवृत्ति इनेगु ज्याझ्वः',
          type: 'केन्द्रीय मुँज्या',
          location: 'स्यस्यः समाज भवन, मंगलबजार • सुथया ११:०० बजे',
          image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'कौला',
          day: '१५',
          title: 'यँयाः समय् बजि इनेगु व सांस्कृतिक चाःहिलेगु',
          type: 'सांस्कृतिक नखः',
          location: 'यल लाय्कू लागा • न्हिनेया २:०० बजे',
          image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
        },
        {
          month: 'कछला',
          day: '०२',
          title: 'सामुदायिक खुला हिदान व उसाँय् जाँचेयायेगु ज्याझ्वः',
          type: 'उसाँय् शिविर',
          location: 'पुल्चोक इलाका समन्वय केन्द्र • सुथया ८:०० - २:००',
          image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    services: {
      badge: 'नागरिक सेवा बडापत्र',
      title: 'अनलाइन नागरिक सेवा व स्थिति स्वयेगु',
      subtitle: 'आवेदन दर्ता नम्बर तयाः थःगु सिफारिस वा म्हसीकापौ स्थिति स्वयादिसँ',
      placeholder: 'आवेदन नं. (उदा. SS-2083-492)',
      checkBtn: 'स्थिति स्वयेगु',
      sampleResult: 'आवेदन #SS-2083-492 — मंगलबजार इलाका संयोजकं सिफारिस जूगु दु। डिजिटल म्हसीकापौ पिदनेगु झ्वलय् दु।',
      links: {
        digitalId: '🪪 डिजिटल म्हसीकापौ व शुल्क नविकरण',
        scholarship: '🎓 जेहेन्दार छात्रवृत्ति आवेदन फारम',
        hallBooking: '🏛️ समाज भवन व भ्वय् हल बुकिङ (२५% छुट)',
        billing: '💼 स्यस्यः धुकू लेखा प्रणाली (/app)',
      },
    },
    blood: {
      title: 'हि पुचः आपतकालीन सञ्जाल',
      subtitle: 'समुदायय् आकस्मिक हि माःगु इलय् तुरुन्त स्वापू तयादिसँ',
      hours: '२४ सै घण्टा सेवा',
      allGroups: 'दक्वं पुचः',
      callBtn: 'सम्पर्क',
      donors: [
        { id: '1', name: 'अमित श्रेष्ठ', group: 'O+', ilaka: 'मंगलबजार', phone: '९८४१-०१२३४५' },
        { id: '2', name: 'प्रमिला श्रेष्ठ', group: 'A+', ilaka: 'पुल्चोक', phone: '९८५१-२३४५६७' },
        { id: '3', name: 'सञ्जय मान श्रेष्ठ', group: 'B+', ilaka: 'त्यागल', phone: '९८०१-९८७६५४' },
        { id: '4', name: 'रोशन श्रेष्ठ', group: 'AB+', ilaka: 'च्यासल', phone: '९८४१-५५६६७७' },
        { id: '5', name: 'सुशील श्रेष्ठ', group: 'O+', ilaka: 'पाटनढोका', phone: '९८५१-४४३३२२' },
      ],
    },
    timeline: {
      badge: 'ऐतिहासिक पलाः',
      title: 'कालक्रम: समाज दयेकेगु ऐतिहासिक कोशेढुङ्गा',
      subtitle: 'ने.सं. १११९ पलिस्था निसें आधुनिक डिजिटल युग तकया गौरवमय इतिहास',
      milestones: [
        {
          year: 'ने.सं. १११९ (1999 AD)',
          title: 'समाजया औपचारिक पलिस्था',
          tag: 'पलिस्था दँ',
          description: 'यलया थीथी त्वाःया श्रेष्ठ थकालिपिं मुनाव स्यस्यः समाज गठन व विधान दर्ता याःगु।',
        },
        {
          year: 'ने.सं. ११२५ (2005 AD)',
          title: '२४ गू इलाका संरचना घोषणा',
          tag: 'विकेन्द्रीकरण',
          description: 'यल देय् दुने सामाजिक सहजताया निंतिं २४ गू इलाकाय् ब्वथलाः स्थानीय संयोजक ल्यःगु।',
        },
        {
          year: 'ने.सं. ११३५ (2015 AD)',
          title: 'तःभुखाचय् ग्वहालि व पुनर्निर्माण',
          tag: 'विपद् उद्धार',
          description: 'भुखाय् ग्रस्त परिवारपिन्त तत्काल बास, नसात्वँसा इनेगु व सम्पदा बचेयायेगु ज्या।',
        },
        {
          year: 'ने.सं. ११४४-४६ (2024-26 AD)',
          title: 'डिजिटल अभिलेखीकरण व लेखा',
          tag: 'डिजिटल युग',
          description: 'अफलाइन लेखा प्रणाली (स्यस्यः धुकू), डिजिटल म्हसीकापौ व पाण्डुलिपि संरक्षण।',
        },
      ],
    },
    archives: {
      badge: 'ऐतिहासिक सम्पदा',
      title: 'डिजिटल संग्रह: सामुदायिक अभिलेख व पाण्डुलिपि',
      subtitle: 'यलया प्राचीन गुथि तमसुक, रीतिथिति निर्णय, पाण्डुलिपि व दुर्लभ तस्बिरत',
      tabAll: 'दक्वं संग्रह',
      tabManuscript: 'तमसुक व पाण्डुलिपि',
      tabPhoto: 'ऐतिहासिक तस्बिर',
      tabGuthi: 'गुथि विधान',
      readMore: 'ब्वनादिसँ →',
      viewPhoto: 'तस्बिर स्वयादिसँ →',
      closeBtn: 'तिनादिसँ',
      downloadPdf: 'डाउनलोड (PDF)',
      items: [
        {
          id: '1',
          category: 'manuscript' as const,
          tag: 'ऐतिहासिक पाण्डुलिपि',
          title: 'यल तलेजु गुथि व्यवस्थापन सम्बन्धी प्राचीन निर्णय',
          era: 'नेपाल संवत् १०४८',
          source: 'क्वाछें गुथि अभिलेख',
          description: 'नेवाः लिपिइ च्वयातःगु ऐतिहासिक तमसुक गन स्यस्यः समुदायया तलेजु देगलय् दँयदसं पर्व पूजा व समय् बजि इनेगु दायित्व दुथ्याःगु दु।',
          image: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '2',
          category: 'photo' as const,
          tag: 'तस्बिर अभिलेख',
          title: 'मंगलबजार व च्यासल गुँला बाजा खलः (वि.सं. २०२४)',
          era: 'वि.सं. २०२४',
          source: 'च्यासल अभिलेख',
          description: 'परम्परागत धाः बाजा, भुस्याः व बाँसुरी थानाः यलया बहाः बही चाःहिलाच्वंगु दुर्लभ श्यामश्वेत तस्बिर।',
          image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: '3',
          category: 'guthi' as const,
          tag: 'गुथि आचारसंहिता',
          title: 'सी गुथि व सनः गुथि परम्परागत आचारसंहिता',
          era: 'अद्यावधिक वि.सं. २०८१',
          source: 'केन्द्रीय सचिवालय',
          description: 'सी ज्या, दाहसंस्कार ग्वहालि व दुजःपिं दथुइ सद्भाव तयातयेत तयार याःगु नियम संग्रह।',
          image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
        },
      ],
    },
    elders: {
      badge: 'धरोहर व्यक्तित्व',
      title: 'हनाबहाःपिं थकालि: समाजया विशिष्ट धरोहर व्यक्तित्वपिं',
      subtitle: 'भाय्, संस्कृति, गुथि व्यवस्थापन व सामाजिक जागरणय् अमूल्य योगदान बियादीपिं महानुभावपिं',
      honorRoll: 'सामुदायिक हनापौ सूची',
      elders: [
        {
          name: 'स्व. पूर्णमान श्रेष्ठ',
          honorificTitle: 'संस्थापक सल्लाहकार',
          field: 'इतिहासविद् व संस्कृतिविद्',
          bio: 'यलया स्यस्यः इतिहास, नेवार जातिया पलिस्था व पाण्डुलिपि अनुसन्धानय् ५ दशक योगदान बियादीपिं विद्वान।',
          initial: 'प',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'श्री सत्यनारायण श्रेष्ठ',
          honorificTitle: 'वरिष्ठ गुथि गुरु',
          field: 'दाफा भजन व राग स्यनामि (८४ दँ)',
          bio: 'च्यासल व मंगलबजारय् प्यपुस्तायात शास्त्रीय दाफा भजन व बाँसुरी वादन स्यनादीपिं गुरु।',
          initial: 'स',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
        },
        {
          name: 'श्रीमती चन्द्रलक्ष्मी श्रेष्ठ',
          honorificTitle: 'सामुदायिक अभियन्ता',
          field: 'मिसा जागरण व मुनिगु पुचः अग्रणी',
          bio: 'यलया थीथी त्वालय् मिसा पुचः गठन यानाः परम्परागत नेवारी नसा उत्पादन व आत्मनिर्भरता अभियान न्ह्याकादीपिं।',
          initial: 'च',
          image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
        },
      ],
    },
  },
} as const

export function getHomeContent(locale: Locale) {
  return homeContent[locale] || homeContent.en
}
