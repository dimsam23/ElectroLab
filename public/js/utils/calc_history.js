// calc_history.js - Module untuk menyimpan & mengambil histori kalkulasi

const CALC_API = "/api/projects/history-calc";

/**
 * Simpan hasil kalkulasi ke database Neon
 * @param {string} operation Nama kalkulasi, misal: "Ohm's Law", "Resistor Series"
 * @param {object} input Parameter input (misal: { v: 12, r: 100 })
 * @param {object} result Hasil kalkulasi (misal: { i: 0.12 })
 */
export async function saveCalcHistory(operation, input, result) {
  try {
    const response = await fetch(CALC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, input, result })
    });
    if (!response.ok) {
      console.error('POST failed', response.status, await response.text());
      return null;
    }
    const json = await response.json();
    console.log('History saved:', json);
    return json;
  } catch (error) {
    console.error("Gagal menyimpan histori kalkulasi:", error);
  }
}

/**
 * Ambil semua riwayat kalkulasi
 */
export async function getCalcHistory() {
  try {
    const response = await fetch(CALC_API);
    return await response.json();
  } catch (error) {
    console.error("Gagal mengambil histori kalkulasi:", error);
    return [];
  }
}
