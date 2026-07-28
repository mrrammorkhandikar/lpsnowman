// Indian Truck Manufacturers and Models Database
// Organized by manufacturer for cascading dropdown selection

export interface TruckModel {
  name: string;
  category: 'lcv' | 'icv' | 'mcv' | 'hcv' | 'mhcv' | 'tractor';
  capacityRange: string; // e.g., "5-9 Ton"
}

export interface TruckManufacturer {
  id: string;
  name: string;
  models: TruckModel[];
}

export const indianTruckManufacturers: TruckManufacturer[] = [
  {
    id: "tata",
    name: "Tata Motors",
    models: [
      { name: "Ace Gold", category: "lcv", capacityRange: "0.75-1 Ton" },
      { name: "Ace HT Plus", category: "lcv", capacityRange: "1-1.5 Ton" },
      { name: "Intra V10", category: "lcv", capacityRange: "1-1.5 Ton" },
      { name: "Intra V20", category: "lcv", capacityRange: "1.5-2 Ton" },
      { name: "Intra V30", category: "lcv", capacityRange: "2-2.5 Ton" },
      { name: "407", category: "lcv", capacityRange: "2.5-3.5 Ton" },
      { name: "709", category: "icv", capacityRange: "5-7 Ton" },
      { name: "712", category: "icv", capacityRange: "7-9 Ton" },
      { name: "912", category: "icv", capacityRange: "8-10 Ton" },
      { name: "1109", category: "icv", capacityRange: "9-11 Ton" },
      { name: "1212", category: "icv", capacityRange: "10-12 Ton" },
      { name: "LPT 1613", category: "mcv", capacityRange: "14-16 Ton" },
      { name: "LPT 1916", category: "mcv", capacityRange: "16-18 Ton" },
      { name: "LPT 2518", category: "hcv", capacityRange: "18-25 Ton" },
      { name: "LPT 3118", category: "hcv", capacityRange: "25-31 Ton" },
      { name: "Signa 4018.S", category: "mhcv", capacityRange: "35-40 Ton" },
      { name: "Signa 4218.S", category: "mhcv", capacityRange: "40-42 Ton" },
      { name: "Signa 4825.TK", category: "mhcv", capacityRange: "45-48 Ton" },
      { name: "Prima 4028.S", category: "tractor", capacityRange: "35-40 Ton" },
      { name: "Prima 4928.S", category: "tractor", capacityRange: "45-49 Ton" },
      { name: "Prima 5530.S", category: "tractor", capacityRange: "50-55 Ton" },
    ]
  },
  {
    id: "ashok_leyland",
    name: "Ashok Leyland",
    models: [
      { name: "Dost+", category: "lcv", capacityRange: "1.25-1.5 Ton" },
      { name: "Dost Strong", category: "lcv", capacityRange: "1.5-2 Ton" },
      { name: "Partner 6 Tyre", category: "lcv", capacityRange: "2.5-3.5 Ton" },
      { name: "Ecomet 1015", category: "icv", capacityRange: "8-10 Ton" },
      { name: "Ecomet 1115", category: "icv", capacityRange: "10-11 Ton" },
      { name: "Ecomet 1215", category: "icv", capacityRange: "11-12 Ton" },
      { name: "Ecomet 1415", category: "mcv", capacityRange: "12-14 Ton" },
      { name: "Ecomet 1615", category: "mcv", capacityRange: "14-16 Ton" },
      { name: "Boss 1616", category: "mcv", capacityRange: "15-16 Ton" },
      { name: "Boss 1916", category: "hcv", capacityRange: "18-19 Ton" },
      { name: "2518", category: "hcv", capacityRange: "22-25 Ton" },
      { name: "2820", category: "hcv", capacityRange: "25-28 Ton" },
      { name: "3120", category: "hcv", capacityRange: "28-31 Ton" },
      { name: "4019", category: "mhcv", capacityRange: "35-40 Ton" },
      { name: "4620", category: "mhcv", capacityRange: "42-46 Ton" },
      { name: "4825", category: "mhcv", capacityRange: "45-48 Ton" },
      { name: "Captain 4019", category: "tractor", capacityRange: "36-40 Ton" },
      { name: "Captain 4923", category: "tractor", capacityRange: "45-49 Ton" },
      { name: "Captain 5525", category: "tractor", capacityRange: "50-55 Ton" },
    ]
  },
  {
    id: "mahindra",
    name: "Mahindra",
    models: [
      { name: "Jeeto Plus", category: "lcv", capacityRange: "0.6-0.8 Ton" },
      { name: "Supro Profit Truck", category: "lcv", capacityRange: "0.8-1 Ton" },
      { name: "Bolero Pickup", category: "lcv", capacityRange: "1.2-1.5 Ton" },
      { name: "Bolero Pickup Extra Long", category: "lcv", capacityRange: "1.5-1.7 Ton" },
      { name: "Furio 7", category: "lcv", capacityRange: "3-3.5 Ton" },
      { name: "Furio 10", category: "icv", capacityRange: "5-6 Ton" },
      { name: "Furio 11", category: "icv", capacityRange: "7-8 Ton" },
      { name: "Furio 12", category: "icv", capacityRange: "8-9 Ton" },
      { name: "Blazo X 25", category: "hcv", capacityRange: "22-25 Ton" },
      { name: "Blazo X 28", category: "hcv", capacityRange: "25-28 Ton" },
      { name: "Blazo X 35", category: "mhcv", capacityRange: "32-35 Ton" },
      { name: "Blazo X 40", category: "mhcv", capacityRange: "37-40 Ton" },
      { name: "Blazo X 46", category: "mhcv", capacityRange: "42-46 Ton" },
      { name: "Blazo X 49", category: "tractor", capacityRange: "45-49 Ton" },
    ]
  },
  {
    id: "eicher",
    name: "Eicher",
    models: [
      { name: "Pro 1049", category: "lcv", capacityRange: "2.5-3 Ton" },
      { name: "Pro 1059 XP", category: "lcv", capacityRange: "3-3.5 Ton" },
      { name: "Pro 1080 XP", category: "icv", capacityRange: "5-6 Ton" },
      { name: "Pro 1095 XP", category: "icv", capacityRange: "6-7 Ton" },
      { name: "Pro 1110 XP", category: "icv", capacityRange: "8-9 Ton" },
      { name: "Pro 2049", category: "icv", capacityRange: "4-5 Ton" },
      { name: "Pro 2059 XP", category: "icv", capacityRange: "5-6 Ton" },
      { name: "Pro 2095 XP", category: "icv", capacityRange: "7-8 Ton" },
      { name: "Pro 2110 XP", category: "icv", capacityRange: "9-10 Ton" },
      { name: "Pro 3015", category: "icv", capacityRange: "10-12 Ton" },
      { name: "Pro 3016", category: "mcv", capacityRange: "13-15 Ton" },
      { name: "Pro 3019", category: "hcv", capacityRange: "16-18 Ton" },
      { name: "Pro 5016", category: "hcv", capacityRange: "18-22 Ton" },
      { name: "Pro 5025", category: "hcv", capacityRange: "22-25 Ton" },
      { name: "Pro 6025", category: "mhcv", capacityRange: "28-30 Ton" },
      { name: "Pro 6031", category: "mhcv", capacityRange: "30-35 Ton" },
      { name: "Pro 6040", category: "mhcv", capacityRange: "36-40 Ton" },
      { name: "Pro 6048", category: "tractor", capacityRange: "42-48 Ton" },
      { name: "Pro 6055", category: "tractor", capacityRange: "50-55 Ton" },
    ]
  },
  {
    id: "bharatbenz",
    name: "BharatBenz",
    models: [
      { name: "914R", category: "icv", capacityRange: "6-8 Ton" },
      { name: "1015R", category: "icv", capacityRange: "8-10 Ton" },
      { name: "1215R", category: "icv", capacityRange: "10-12 Ton" },
      { name: "1415RE", category: "mcv", capacityRange: "12-14 Ton" },
      { name: "1617R", category: "mcv", capacityRange: "14-16 Ton" },
      { name: "1917R", category: "hcv", capacityRange: "16-18 Ton" },
      { name: "2523R", category: "hcv", capacityRange: "22-25 Ton" },
      { name: "2823R", category: "hcv", capacityRange: "25-28 Ton" },
      { name: "3123R", category: "hcv", capacityRange: "28-31 Ton" },
      { name: "3528R", category: "mhcv", capacityRange: "32-35 Ton" },
      { name: "4028R", category: "mhcv", capacityRange: "37-40 Ton" },
      { name: "4228R", category: "mhcv", capacityRange: "40-42 Ton" },
      { name: "4828TT", category: "tractor", capacityRange: "45-48 Ton" },
      { name: "5528TT", category: "tractor", capacityRange: "50-55 Ton" },
    ]
  },
  {
    id: "force_motors",
    name: "Force Motors",
    models: [
      { name: "Shaktiman 200", category: "lcv", capacityRange: "1-1.5 Ton" },
      { name: "Shaktiman 400", category: "lcv", capacityRange: "2-2.5 Ton" },
      { name: "Trump 40", category: "lcv", capacityRange: "3-4 Ton" },
    ]
  },
  {
    id: "volvo",
    name: "Volvo",
    models: [
      { name: "FH 420", category: "mhcv", capacityRange: "40-45 Ton" },
      { name: "FH 460", category: "mhcv", capacityRange: "45-50 Ton" },
      { name: "FH 500", category: "mhcv", capacityRange: "50-55 Ton" },
      { name: "FH 540", category: "tractor", capacityRange: "52-58 Ton" },
      { name: "FM 420", category: "mhcv", capacityRange: "38-42 Ton" },
      { name: "FM 460", category: "mhcv", capacityRange: "42-46 Ton" },
      { name: "FMX 440", category: "mhcv", capacityRange: "40-44 Ton" },
      { name: "FMX 480", category: "mhcv", capacityRange: "44-48 Ton" },
    ]
  },
  {
    id: "scania",
    name: "Scania",
    models: [
      { name: "P 410", category: "mhcv", capacityRange: "38-42 Ton" },
      { name: "G 460", category: "mhcv", capacityRange: "42-46 Ton" },
      { name: "R 500", category: "mhcv", capacityRange: "46-50 Ton" },
      { name: "R 540", category: "tractor", capacityRange: "50-54 Ton" },
      { name: "S 500", category: "tractor", capacityRange: "48-52 Ton" },
      { name: "S 540", category: "tractor", capacityRange: "52-56 Ton" },
    ]
  },
  {
    id: "man",
    name: "MAN",
    models: [
      { name: "CLA 31.280", category: "hcv", capacityRange: "28-31 Ton" },
      { name: "CLA 35.300", category: "mhcv", capacityRange: "32-35 Ton" },
      { name: "CLA 40.300", category: "mhcv", capacityRange: "37-40 Ton" },
      { name: "CLA 49.300", category: "tractor", capacityRange: "45-49 Ton" },
    ]
  },
  {
    id: "isuzu",
    name: "Isuzu",
    models: [
      { name: "D-Max S-Cab", category: "lcv", capacityRange: "1-1.2 Ton" },
      { name: "D-Max Hi-Lander", category: "lcv", capacityRange: "1-1.2 Ton" },
    ]
  },
  {
    id: "other",
    name: "Other",
    models: [
      { name: "Other Model", category: "icv", capacityRange: "Varies" },
    ]
  }
];

// Helper function to get models by manufacturer ID
export function getModelsByManufacturer(manufacturerId: string): TruckModel[] {
  const manufacturer = indianTruckManufacturers.find(m => m.id === manufacturerId);
  return manufacturer?.models || [];
}

// Helper function to get manufacturer name by ID
export function getManufacturerName(manufacturerId: string): string {
  const manufacturer = indianTruckManufacturers.find(m => m.id === manufacturerId);
  return manufacturer?.name || manufacturerId;
}
