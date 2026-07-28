// Indian States and Major Cities Database
// Organized by state for cascading dropdown selection

export interface City {
  name: string;
  isMetro?: boolean; // Major metropolitan city
}

export interface IndianState {
  code: string;
  name: string;
  cities: City[];
}

export const indianStates: IndianState[] = [
  {
    code: "AN",
    name: "Andaman and Nicobar Islands",
    cities: [
      { name: "Port Blair", isMetro: false },
    ]
  },
  {
    code: "AP",
    name: "Andhra Pradesh",
    cities: [
      { name: "Visakhapatnam", isMetro: true },
      { name: "Vijayawada", isMetro: true },
      { name: "Guntur" },
      { name: "Nellore" },
      { name: "Kurnool" },
      { name: "Tirupati" },
      { name: "Rajahmundry" },
      { name: "Kakinada" },
      { name: "Kadapa" },
      { name: "Anantapur" },
      { name: "Eluru" },
      { name: "Ongole" },
      { name: "Nandyal" },
      { name: "Machilipatnam" },
      { name: "Adoni" },
      { name: "Tenali" },
      { name: "Chittoor" },
      { name: "Proddatur" },
      { name: "Hindupur" },
      { name: "Bhimavaram" },
    ]
  },
  {
    code: "AR",
    name: "Arunachal Pradesh",
    cities: [
      { name: "Itanagar" },
      { name: "Naharlagun" },
      { name: "Pasighat" },
      { name: "Tawang" },
    ]
  },
  {
    code: "AS",
    name: "Assam",
    cities: [
      { name: "Guwahati", isMetro: true },
      { name: "Silchar" },
      { name: "Dibrugarh" },
      { name: "Jorhat" },
      { name: "Nagaon" },
      { name: "Tinsukia" },
      { name: "Tezpur" },
      { name: "Bongaigaon" },
    ]
  },
  {
    code: "BR",
    name: "Bihar",
    cities: [
      { name: "Patna", isMetro: true },
      { name: "Gaya" },
      { name: "Bhagalpur" },
      { name: "Muzaffarpur" },
      { name: "Darbhanga" },
      { name: "Bihar Sharif" },
      { name: "Arrah" },
      { name: "Begusarai" },
      { name: "Katihar" },
      { name: "Munger" },
      { name: "Purnia" },
      { name: "Saharsa" },
      { name: "Hajipur" },
      { name: "Sasaram" },
      { name: "Bettiah" },
      { name: "Samastipur" },
    ]
  },
  {
    code: "CG",
    name: "Chhattisgarh",
    cities: [
      { name: "Raipur", isMetro: true },
      { name: "Bhilai" },
      { name: "Bilaspur" },
      { name: "Korba" },
      { name: "Durg" },
      { name: "Rajnandgaon" },
      { name: "Raigarh" },
      { name: "Jagdalpur" },
      { name: "Ambikapur" },
    ]
  },
  {
    code: "CH",
    name: "Chandigarh",
    cities: [
      { name: "Chandigarh", isMetro: true },
    ]
  },
  {
    code: "DD",
    name: "Dadra and Nagar Haveli and Daman and Diu",
    cities: [
      { name: "Silvassa" },
      { name: "Daman" },
      { name: "Diu" },
    ]
  },
  {
    code: "DL",
    name: "Delhi",
    cities: [
      { name: "New Delhi", isMetro: true },
      { name: "North Delhi", isMetro: true },
      { name: "South Delhi", isMetro: true },
      { name: "East Delhi", isMetro: true },
      { name: "West Delhi", isMetro: true },
      { name: "Central Delhi", isMetro: true },
    ]
  },
  {
    code: "GA",
    name: "Goa",
    cities: [
      { name: "Panaji" },
      { name: "Margao" },
      { name: "Vasco da Gama" },
      { name: "Mapusa" },
      { name: "Ponda" },
    ]
  },
  {
    code: "GJ",
    name: "Gujarat",
    cities: [
      { name: "Ahmedabad", isMetro: true },
      { name: "Surat", isMetro: true },
      { name: "Vadodara", isMetro: true },
      { name: "Rajkot", isMetro: true },
      { name: "Bhavnagar" },
      { name: "Jamnagar" },
      { name: "Junagadh" },
      { name: "Gandhinagar" },
      { name: "Gandhidham" },
      { name: "Anand" },
      { name: "Navsari" },
      { name: "Morbi" },
      { name: "Nadiad" },
      { name: "Surendranagar" },
      { name: "Bharuch" },
      { name: "Mehsana" },
      { name: "Valsad" },
      { name: "Vapi" },
      { name: "Porbandar" },
      { name: "Mundra" },
    ]
  },
  {
    code: "HR",
    name: "Haryana",
    cities: [
      { name: "Faridabad", isMetro: true },
      { name: "Gurugram", isMetro: true },
      { name: "Panipat" },
      { name: "Ambala" },
      { name: "Yamunanagar" },
      { name: "Rohtak" },
      { name: "Hisar" },
      { name: "Karnal" },
      { name: "Sonipat" },
      { name: "Panchkula" },
      { name: "Bhiwani" },
      { name: "Sirsa" },
      { name: "Rewari" },
      { name: "Palwal" },
      { name: "Bahadurgarh" },
      { name: "Jind" },
      { name: "Kaithal" },
    ]
  },
  {
    code: "HP",
    name: "Himachal Pradesh",
    cities: [
      { name: "Shimla" },
      { name: "Dharamsala" },
      { name: "Solan" },
      { name: "Mandi" },
      { name: "Palampur" },
      { name: "Baddi" },
      { name: "Nahan" },
      { name: "Kullu" },
      { name: "Bilaspur" },
      { name: "Una" },
    ]
  },
  {
    code: "JK",
    name: "Jammu and Kashmir",
    cities: [
      { name: "Srinagar", isMetro: true },
      { name: "Jammu", isMetro: true },
      { name: "Anantnag" },
      { name: "Baramulla" },
      { name: "Sopore" },
      { name: "Udhampur" },
      { name: "Kathua" },
    ]
  },
  {
    code: "JH",
    name: "Jharkhand",
    cities: [
      { name: "Ranchi", isMetro: true },
      { name: "Jamshedpur", isMetro: true },
      { name: "Dhanbad" },
      { name: "Bokaro Steel City" },
      { name: "Hazaribagh" },
      { name: "Deoghar" },
      { name: "Giridih" },
      { name: "Ramgarh" },
      { name: "Phusro" },
      { name: "Chaibasa" },
    ]
  },
  {
    code: "KA",
    name: "Karnataka",
    cities: [
      { name: "Bengaluru", isMetro: true },
      { name: "Mysuru", isMetro: true },
      { name: "Mangaluru" },
      { name: "Hubli-Dharwad" },
      { name: "Belagavi" },
      { name: "Gulbarga" },
      { name: "Davangere" },
      { name: "Bellary" },
      { name: "Shimoga" },
      { name: "Tumkur" },
      { name: "Bijapur" },
      { name: "Raichur" },
      { name: "Bidar" },
      { name: "Hospet" },
      { name: "Gadag" },
      { name: "Hassan" },
      { name: "Udupi" },
      { name: "Mandya" },
      { name: "Chikmagalur" },
      { name: "Karwar" },
    ]
  },
  {
    code: "KL",
    name: "Kerala",
    cities: [
      { name: "Kochi", isMetro: true },
      { name: "Thiruvananthapuram", isMetro: true },
      { name: "Kozhikode", isMetro: true },
      { name: "Thrissur" },
      { name: "Kollam" },
      { name: "Kannur" },
      { name: "Alappuzha" },
      { name: "Palakkad" },
      { name: "Kottayam" },
      { name: "Malappuram" },
      { name: "Pathanamthitta" },
      { name: "Idukki" },
      { name: "Wayanad" },
      { name: "Kasaragod" },
    ]
  },
  {
    code: "LA",
    name: "Ladakh",
    cities: [
      { name: "Leh" },
      { name: "Kargil" },
    ]
  },
  {
    code: "MP",
    name: "Madhya Pradesh",
    cities: [
      { name: "Indore", isMetro: true },
      { name: "Bhopal", isMetro: true },
      { name: "Jabalpur" },
      { name: "Gwalior" },
      { name: "Ujjain" },
      { name: "Sagar" },
      { name: "Dewas" },
      { name: "Satna" },
      { name: "Ratlam" },
      { name: "Rewa" },
      { name: "Murwara" },
      { name: "Singrauli" },
      { name: "Burhanpur" },
      { name: "Khandwa" },
      { name: "Bhind" },
      { name: "Chhindwara" },
      { name: "Guna" },
      { name: "Shivpuri" },
      { name: "Vidisha" },
      { name: "Damoh" },
    ]
  },
  {
    code: "MH",
    name: "Maharashtra",
    cities: [
      { name: "Mumbai", isMetro: true },
      { name: "Pune", isMetro: true },
      { name: "Nagpur", isMetro: true },
      { name: "Thane", isMetro: true },
      { name: "Nashik" },
      { name: "Aurangabad" },
      { name: "Solapur" },
      { name: "Kolhapur" },
      { name: "Amravati" },
      { name: "Navi Mumbai", isMetro: true },
      { name: "Pimpri-Chinchwad", isMetro: true },
      { name: "Akola" },
      { name: "Latur" },
      { name: "Dhule" },
      { name: "Ahmednagar" },
      { name: "Chandrapur" },
      { name: "Parbhani" },
      { name: "Jalgaon" },
      { name: "Bhiwandi" },
      { name: "Nanded" },
      { name: "Sangli" },
      { name: "Malegaon" },
      { name: "Satara" },
      { name: "Ratnagiri" },
      { name: "Wardha" },
    ]
  },
  {
    code: "MN",
    name: "Manipur",
    cities: [
      { name: "Imphal" },
      { name: "Thoubal" },
      { name: "Bishnupur" },
    ]
  },
  {
    code: "ML",
    name: "Meghalaya",
    cities: [
      { name: "Shillong" },
      { name: "Tura" },
      { name: "Jowai" },
    ]
  },
  {
    code: "MZ",
    name: "Mizoram",
    cities: [
      { name: "Aizawl" },
      { name: "Lunglei" },
      { name: "Champhai" },
    ]
  },
  {
    code: "NL",
    name: "Nagaland",
    cities: [
      { name: "Kohima" },
      { name: "Dimapur" },
      { name: "Mokokchung" },
    ]
  },
  {
    code: "OD",
    name: "Odisha",
    cities: [
      { name: "Bhubaneswar", isMetro: true },
      { name: "Cuttack" },
      { name: "Rourkela" },
      { name: "Berhampur" },
      { name: "Sambalpur" },
      { name: "Puri" },
      { name: "Balasore" },
      { name: "Bhadrak" },
      { name: "Baripada" },
      { name: "Jharsuguda" },
    ]
  },
  {
    code: "PY",
    name: "Puducherry",
    cities: [
      { name: "Puducherry" },
      { name: "Karaikal" },
    ]
  },
  {
    code: "PB",
    name: "Punjab",
    cities: [
      { name: "Ludhiana", isMetro: true },
      { name: "Amritsar", isMetro: true },
      { name: "Jalandhar" },
      { name: "Patiala" },
      { name: "Bathinda" },
      { name: "Mohali" },
      { name: "Pathankot" },
      { name: "Hoshiarpur" },
      { name: "Moga" },
      { name: "Batala" },
      { name: "Abohar" },
      { name: "Malerkotla" },
      { name: "Khanna" },
      { name: "Phagwara" },
      { name: "Muktsar" },
      { name: "Barnala" },
      { name: "Rajpura" },
      { name: "Firozpur" },
      { name: "Kapurthala" },
    ]
  },
  {
    code: "RJ",
    name: "Rajasthan",
    cities: [
      { name: "Jaipur", isMetro: true },
      { name: "Jodhpur", isMetro: true },
      { name: "Kota" },
      { name: "Bikaner" },
      { name: "Udaipur" },
      { name: "Ajmer" },
      { name: "Bhilwara" },
      { name: "Alwar" },
      { name: "Sikar" },
      { name: "Bharatpur" },
      { name: "Sri Ganganagar" },
      { name: "Pali" },
      { name: "Beawar" },
      { name: "Hanumangarh" },
      { name: "Tonk" },
      { name: "Kishangarh" },
      { name: "Barmer" },
      { name: "Churu" },
      { name: "Nagaur" },
      { name: "Jhunjhunu" },
    ]
  },
  {
    code: "SK",
    name: "Sikkim",
    cities: [
      { name: "Gangtok" },
      { name: "Namchi" },
      { name: "Gyalshing" },
    ]
  },
  {
    code: "TN",
    name: "Tamil Nadu",
    cities: [
      { name: "Chennai", isMetro: true },
      { name: "Coimbatore", isMetro: true },
      { name: "Madurai", isMetro: true },
      { name: "Tiruchirappalli" },
      { name: "Salem" },
      { name: "Tirunelveli" },
      { name: "Tiruppur" },
      { name: "Vellore" },
      { name: "Erode" },
      { name: "Thoothukkudi" },
      { name: "Dindigul" },
      { name: "Thanjavur" },
      { name: "Ranipet" },
      { name: "Sivakasi" },
      { name: "Karur" },
      { name: "Udhagamandalam" },
      { name: "Hosur" },
      { name: "Nagercoil" },
      { name: "Kanchipuram" },
      { name: "Kumarapalayam" },
    ]
  },
  {
    code: "TS",
    name: "Telangana",
    cities: [
      { name: "Hyderabad", isMetro: true },
      { name: "Warangal" },
      { name: "Nizamabad" },
      { name: "Karimnagar" },
      { name: "Khammam" },
      { name: "Ramagundam" },
      { name: "Mahbubnagar" },
      { name: "Nalgonda" },
      { name: "Adilabad" },
      { name: "Suryapet" },
      { name: "Siddipet" },
      { name: "Miryalaguda" },
      { name: "Mancherial" },
    ]
  },
  {
    code: "TR",
    name: "Tripura",
    cities: [
      { name: "Agartala" },
      { name: "Udaipur" },
      { name: "Dharmanagar" },
    ]
  },
  {
    code: "UK",
    name: "Uttarakhand",
    cities: [
      { name: "Dehradun" },
      { name: "Haridwar" },
      { name: "Roorkee" },
      { name: "Haldwani" },
      { name: "Rudrapur" },
      { name: "Kashipur" },
      { name: "Rishikesh" },
      { name: "Nainital" },
      { name: "Ramnagar" },
    ]
  },
  {
    code: "UP",
    name: "Uttar Pradesh",
    cities: [
      { name: "Lucknow", isMetro: true },
      { name: "Kanpur", isMetro: true },
      { name: "Ghaziabad", isMetro: true },
      { name: "Agra", isMetro: true },
      { name: "Varanasi", isMetro: true },
      { name: "Prayagraj" },
      { name: "Meerut" },
      { name: "Noida", isMetro: true },
      { name: "Greater Noida", isMetro: true },
      { name: "Bareilly" },
      { name: "Aligarh" },
      { name: "Moradabad" },
      { name: "Saharanpur" },
      { name: "Gorakhpur" },
      { name: "Firozabad" },
      { name: "Jhansi" },
      { name: "Muzaffarnagar" },
      { name: "Mathura" },
      { name: "Rampur" },
      { name: "Shahjahanpur" },
      { name: "Faizabad" },
      { name: "Etawah" },
      { name: "Mirzapur" },
      { name: "Bulandshahr" },
      { name: "Sambhal" },
      { name: "Amroha" },
      { name: "Hardoi" },
      { name: "Fatehpur" },
      { name: "Raebareli" },
      { name: "Orai" },
    ]
  },
  {
    code: "WB",
    name: "West Bengal",
    cities: [
      { name: "Kolkata", isMetro: true },
      { name: "Howrah" },
      { name: "Asansol" },
      { name: "Siliguri" },
      { name: "Durgapur" },
      { name: "Bardhaman" },
      { name: "Malda" },
      { name: "Baharampur" },
      { name: "Habra" },
      { name: "Kharagpur" },
      { name: "Shantipur" },
      { name: "Dankuni" },
      { name: "Dhulian" },
      { name: "Ranaghat" },
      { name: "Haldia" },
      { name: "Raiganj" },
      { name: "Krishnanagar" },
      { name: "Nabadwip" },
      { name: "Medinipur" },
      { name: "Jalpaiguri" },
    ]
  }
];

// Helper function to get cities by state code
export function getCitiesByState(stateCode: string): City[] {
  const state = indianStates.find(s => s.code === stateCode);
  return state?.cities || [];
}

// Helper function to get state name by code
export function getStateName(stateCode: string): string {
  const state = indianStates.find(s => s.code === stateCode);
  return state?.name || stateCode;
}

// Sort states alphabetically by name
export const sortedIndianStates = [...indianStates].sort((a, b) => a.name.localeCompare(b.name));

// Get all metro cities across all states
export function getAllMetroCities(): { state: IndianState; city: City }[] {
  const metros: { state: IndianState; city: City }[] = [];
  for (const state of indianStates) {
    for (const city of state.cities) {
      if (city.isMetro) {
        metros.push({ state, city });
      }
    }
  }
  return metros;
}
