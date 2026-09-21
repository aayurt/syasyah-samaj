export interface IlakaDetail {
  id: string
  code: string
  nameEn: string
  nameNe: string
  nameNew: string
  slug: string
  coordinator: {
    nameEn: string
    nameNe: string
    phone: string
  }
  addressEn: string
  addressNe: string
  familiesCount: number
  bloodDonorsCount: number
  landmarksEn: string[]
  landmarksNe: string[]
  image: string
}

export const ilakas24Data: IlakaDetail[] = [
  {
    id: '1',
    code: 'IL01',
    nameEn: 'Mangal Bazaar / Kwachhen',
    nameNe: 'मंगलबजार / क्वाछें',
    nameNew: 'मंगलबजार / क्वाछेँ',
    slug: 'mangalbazar',
    coordinator: {
      nameEn: 'Rajendra Shrestha',
      nameNe: 'श्री राजेन्द्र श्रेष्ठ',
      phone: '9841-234567',
    },
    addressEn: 'Patan Durbar Square North, Kwachhen Tole',
    addressNe: 'पाटन दरवार उत्तर, क्वाछें टोल',
    familiesCount: 124,
    bloodDonorsCount: 28,
    landmarksEn: ['Krishna Mandir', 'Taleju Temple', 'Mani Keshab Narayan Chowk'],
    landmarksNe: ['कृष्ण मन्दिर', 'तलेजु भवानी', 'मणि केशव नारायण चोक'],
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: '2',
    code: 'IL02',
    nameEn: 'Pulchowk / Kupandole',
    nameNe: 'पुल्चोक / कुपण्डोल',
    nameNew: 'पुल्चोक / कुपन्दोल',
    slug: 'pulchowk',
    coordinator: {
      nameEn: 'Surendra Raj Shrestha',
      nameNe: 'श्री सुरेन्द्र राज श्रेष्ठ',
      phone: '9851-012345',
    },
    addressEn: 'Near Damkal Chok & Stupa',
    addressNe: 'दमकल चोक तथा उत्तर अशोक स्तूप नजिक',
    familiesCount: 98,
    bloodDonorsCount: 22,
    landmarksEn: ['Patan Ashoka Stupa', 'Kamal Pokhari', 'UN House Area'],
    landmarksNe: ['उत्तरी अशोक स्तूप', 'कमल पोखरी', 'दमकल चोक'],
    image: 'https://images.unsplash.com/photo-1582650625119-3a31f8418bb9?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: '3',
    code: 'IL03',
    nameEn: 'Tyagal / Lagankhel',
    nameNe: 'त्यागल / लगनखेल',
    nameNew: 'त्यागल / लगंख्येँ',
    slug: 'tyagal',
    coordinator: {
      nameEn: 'Sunita Shrestha',
      nameNe: 'श्रीमती सुनिता श्रेष्ठ',
      phone: '9841-556677',
    },
    addressEn: 'Tyagal Tole, Lagankhel Buspark South',
    addressNe: 'त्यागल टोल, लगनखेल दक्षिण',
    familiesCount: 142,
    bloodDonorsCount: 34,
    landmarksEn: ['Southern Ashoka Stupa', 'Batuk Bhairav', 'Lagankhel Pokhari'],
    landmarksNe: ['दक्षिणी अशोक स्तूप', 'बटुक भैरव', 'लगनखेल पोखरी'],
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: '4',
    code: 'IL04',
    nameEn: 'Patan Dhoka / Ikhalakhu',
    nameNe: 'पाटनढोका / इखालखु',
    nameNew: 'पाटनढोका / इखालखु',
    slug: 'patandhoka',
    coordinator: {
      nameEn: 'Kiran Kumar Shrestha',
      nameNe: 'श्री किरण कुमार श्रेष्ठ',
      phone: '9801-234567',
    },
    addressEn: 'Na-Bahal Gateway, Patan Dhoka',
    addressNe: 'नःबहाल, पाटनढोका प्रवेशद्वार',
    familiesCount: 110,
    bloodDonorsCount: 19,
    landmarksEn: ['Patan Historical Gate', 'Pimbahal Pokhari', 'Chandeshwori Temple'],
    landmarksNe: ['पाटन ऐतिहासिक ढोका', 'पिम्बहाल पोखरी', 'चण्डेश्वरी मन्दिर'],
    image: 'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: '5',
    code: 'IL05',
    nameEn: 'Chyasal / Guita',
    nameNe: 'च्यासल / गुइतः',
    nameNew: 'च्यासल / गुइतः',
    slug: 'chyasal',
    coordinator: {
      nameEn: 'Bikram Shrestha',
      nameNe: 'श्री बिक्रम श्रेष्ठ',
      phone: '9841-778899',
    },
    addressEn: 'Chyasal Square & Traditional Hiti',
    addressNe: 'च्यासल चोक तथा ऐतिहासिक ढुङ्गेधारा',
    familiesCount: 165,
    bloodDonorsCount: 42,
    landmarksEn: ['Chyasal Dha Bhajan Khalah', 'Historical Hiti', 'Yankhu Ghat'],
    landmarksNe: ['च्यासल धाः भजन खलः', 'प्राचीन ढुङ्गेधारा', 'यांखु घाट'],
    image: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: '6',
    code: 'IL06',
    nameEn: 'Sundhara / Thapahiti',
    nameNe: 'सुन्धारा / थपाहिटी',
    nameNew: 'लुँहिति / थपाहिति',
    slug: 'sundhara',
    coordinator: {
      nameEn: 'Rabin Shrestha',
      nameNe: 'श्री रबिन श्रेष्ठ',
      phone: '9851-998877',
    },
    addressEn: 'Sundhara Golden Spout Area',
    addressNe: 'सुन्धारा लुँहिति क्षेत्र',
    familiesCount: 88,
    bloodDonorsCount: 16,
    landmarksEn: ['Sundhara Golden Spout', 'Maha Bouddha Temple', 'Hakha Bahal'],
    landmarksNe: ['सुन्धारा (लुँहिति)', 'महाबौद्ध मन्दिर', 'हख बहाल'],
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
  },
]
