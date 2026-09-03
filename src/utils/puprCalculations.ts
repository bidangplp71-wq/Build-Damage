import { PUPRSubComponentConfig, SubComponentAssessment, DamageClassification } from '../types';

export const PUPR_MASTER_COMPONENTS: PUPRSubComponentConfig[] = [
  // 1. Pondasi
  {
    id: 'pondasi_1',
    componentNo: 1,
    componentName: 'Pondasi',
    subComponentName: 'Pondasi',
    bobotPercent: 7.00,
    kerusakanMaxPercent: 15.00,
  },
  // 2. Struktur
  {
    id: 'struktur_kolom_balok',
    componentNo: 2,
    componentName: 'Struktur',
    subComponentName: 'Kolom & Balok',
    bobotPercent: 21.50,
    kerusakanMaxPercent: 30.00,
  },
  {
    id: 'struktur_plesteran',
    componentNo: 2,
    componentName: 'Struktur',
    subComponentName: 'Plesteran',
    bobotPercent: 4.00,
    kerusakanMaxPercent: 100.00,
  },
  // 3. Atap
  {
    id: 'atap_kuda_kuda',
    componentNo: 3,
    componentName: 'Atap',
    subComponentName: 'Kuda-kuda',
    bobotPercent: 5.00,
    kerusakanMaxPercent: 30.00,
  },
  {
    id: 'atap_gording',
    componentNo: 3,
    componentName: 'Atap',
    subComponentName: 'Gording',
    bobotPercent: 4.50,
    kerusakanMaxPercent: 75.00,
  },
  {
    id: 'atap_penutup',
    componentNo: 3,
    componentName: 'Atap',
    subComponentName: 'Penutup atap',
    bobotPercent: 2.00,
    kerusakanMaxPercent: 100.00,
  },
  // 4. Langit-langit
  {
    id: 'langit_rangka',
    componentNo: 4,
    componentName: 'Langit-langit',
    subComponentName: 'Rangka langit-langit',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'langit_penutup',
    componentNo: 4,
    componentName: 'Langit-langit',
    subComponentName: 'Penutup Langit-langit',
    bobotPercent: 4.00,
    kerusakanMaxPercent: 100.00,
  },
  // 5. Dinding
  {
    id: 'dinding_bata',
    componentNo: 5,
    componentName: 'Dinding',
    subComponentName: 'Batu bata / Bataco',
    bobotPercent: 7.00,
    kerusakanMaxPercent: 50.00,
  },
  {
    id: 'dinding_plesteran',
    componentNo: 5,
    componentName: 'Dinding',
    subComponentName: 'Plesteran',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'dinding_kaca',
    componentNo: 5,
    componentName: 'Dinding',
    subComponentName: 'Kaca',
    bobotPercent: 2.50,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'dinding_pintu',
    componentNo: 5,
    componentName: 'Dinding',
    subComponentName: 'Pintu',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'dinding_kosen',
    componentNo: 5,
    componentName: 'Dinding',
    subComponentName: 'Kosen',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  // 6. Lantai
  {
    id: 'lantai_penutup',
    componentNo: 6,
    componentName: 'Lantai',
    subComponentName: 'Penutup lantai',
    bobotPercent: 10.50,
    kerusakanMaxPercent: 100.00,
  },
  // 7. Utilitas
  {
    id: 'utilitas_listrik',
    componentNo: 7,
    componentName: 'Utilitas',
    subComponentName: 'Instalasi Listrik',
    bobotPercent: 4.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'utilitas_air',
    componentNo: 7,
    componentName: 'Utilitas',
    subComponentName: 'Instalasi Air',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'utilitas_drainase',
    componentNo: 7,
    componentName: 'Utilitas',
    subComponentName: 'Drainase Limbah',
    bobotPercent: 1.00,
    kerusakanMaxPercent: 100.00,
  },
  // 8. Finishing
  {
    id: 'finishing_struktur',
    componentNo: 8,
    componentName: 'Finishing',
    subComponentName: 'Finishing Struktur (cat)',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'finishing_langit',
    componentNo: 8,
    componentName: 'Finishing',
    subComponentName: 'Finishing Langit-langit (cat)',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'finishing_dinding',
    componentNo: 8,
    componentName: 'Finishing',
    subComponentName: 'Finishing Dinding (cat)',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
  {
    id: 'finishing_kosen_pintu',
    componentNo: 8,
    componentName: 'Finishing',
    subComponentName: 'Finishing Kosen / Daun pintu jendela (cat kayu)',
    bobotPercent: 3.00,
    kerusakanMaxPercent: 100.00,
  },
];

export function getInitialSubComponents(): SubComponentAssessment[] {
  return PUPR_MASTER_COMPONENTS.map((comp) => ({
    ...comp,
    damagePercentInput: 0,
    calculatedScore: 0,
    notes: '',
  }));
}

/**
 * Calculates component damage score according to PUPR formula
 * Nilai = Bobot Komponen (%) * (Tingkat Kerusakan Teramati % / 100)
 */
export function calculateComponentScore(bobot: number, damageInput: number): number {
  const score = (bobot * damageInput) / 100;
  return Number(score.toFixed(2));
}

/**
 * Calculates total damage percent from components array
 */
export function calculateTotalDamage(components: SubComponentAssessment[]): number {
  const sum = components.reduce((acc, curr) => acc + curr.calculatedScore, 0);
  return Number(sum.toFixed(2));
}

/**
 * PUPR Damage Classification Standard:
 * - Ringan: < 30%
 * - Sedang: 30% s/d 45%
 * - Berat: > 45% s/d 65%
 * - Sangat Berat: > 65%
 */
export function classifyDamage(damagePercent: number): DamageClassification {
  if (damagePercent <= 30.0) {
    return 'Rusak Ringan';
  } else if (damagePercent <= 45.0) {
    return 'Rusak Sedang';
  } else if (damagePercent <= 65.0) {
    return 'Rusak Berat';
  } else {
    return 'Rusak Sangat Berat';
  }
}

/**
 * Calculate full rehabilitation cost estimation based on PUPR guidelines
 */
export function calculateRehabCosts(
  totalDamagePercent: number,
  totalFloorAreaM2: number,
  hsbgnPerM2: number,
  demolitionPercent: number = 8.0
) {
  // Nilai Perawatan / M2 = (totalDamagePercent / 100) * hsbgnPerM2
  const treatmentCostPerM2 = Math.round((totalDamagePercent / 100) * hsbgnPerM2);
  
  // Biaya bongkaran / perapihan = demolitionPercent% * treatmentCostPerM2
  const demolitionCostPerM2 = Math.round((demolitionPercent / 100) * treatmentCostPerM2);
  
  // Total Biaya / M2
  const totalCostPerM2 = treatmentCostPerM2 + demolitionCostPerM2;
  
  // Ajuan Biaya Rehabilitasi = totalFloorAreaM2 * totalCostPerM2
  const totalRehabCost = Math.round(totalFloorAreaM2 * totalCostPerM2);
  
  // Pembulatan ke ratusan ribu terdekat
  const roundedRehabCost = Math.round(totalRehabCost / 100000) * 100000;
  
  const costTerbilang = terbilang(roundedRehabCost) + ' Rupiah';

  return {
    treatmentCostPerM2,
    demolitionCostPerM2,
    totalCostPerM2,
    totalRehabCost,
    roundedRehabCost,
    costTerbilang,
  };
}

/**
 * Indonesian Rupiah Formatter
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Converts numbers to Indonesian words (Terbilang)
 */
export function terbilang(n: number): string {
  if (n < 0) return 'Minus ' + terbilang(Math.abs(n));
  if (n === 0) return 'Nol';

  const angka = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas'
  ];

  let hasil = '';

  if (n < 12) {
    hasil = angka[n];
  } else if (n < 20) {
    hasil = terbilang(n - 10) + ' Belas';
  } else if (n < 100) {
    hasil = terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10);
  } else if (n < 200) {
    hasil = 'Seratus ' + terbilang(n - 100);
  } else if (n < 1000) {
    hasil = terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100);
  } else if (n < 2000) {
    hasil = 'Seribu ' + terbilang(n - 1000);
  } else if (n < 1000000) {
    hasil = terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000);
  } else if (n < 1000000000) {
    hasil = terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000);
  } else if (n < 1000000000000) {
    hasil = terbilang(Math.floor(n / 1000000000)) + ' Milyar ' + terbilang(n % 1000000000);
  } else {
    hasil = terbilang(Math.floor(n / 1000000000000)) + ' Triliun ' + terbilang(n % 1000000000000);
  }

  return hasil.replace(/\s+/g, ' ').trim();
}
