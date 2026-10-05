"""Satuan elektronika: konversi, nama satuan, dan format tampilan."""
from decimal import Decimal

from .errors import CalculationError

# Karakter khusus ditulis dengan kode Unicode supaya tidak tertukar
# dengan karakter lain yang mirip (misalnya µ micro vs μ huruf Yunani).
MICRO = "\u00b5"  # µ
OHM = "\u03a9"  # Ω

# Setiap satuan disimpan sebagai faktor terhadap satuan dasar (V, A, Ω, W, F, s).
UNITS = {
    "voltage": {"base": "V", "units": {"mV": 1e-3, "V": 1.0, "kV": 1e3}},
    "current": {"base": "A", "units": {f"{MICRO}A": 1e-6, "mA": 1e-3, "A": 1.0}},
    "resistance": {
        "base": OHM,
        "units": {OHM: 1.0, f"k{OHM}": 1e3, f"M{OHM}": 1e6},
    },
    "power": {"base": "W", "units": {"mW": 1e-3, "W": 1.0, "kW": 1e3}},
    "capacitance": {
        "base": "F",
        "units": {"pF": 1e-12, "nF": 1e-9, f"{MICRO}F": 1e-6, "mF": 1e-3, "F": 1.0},
    },
        "time": {
            "base": "s",
            "units": {f"{MICRO}s": 1e-6, "ms": 1e-3, "s": 1.0, "min": 60.0, "h": 3600.0},
    },
    # Energi: 1 Wh = 3600 J (1 watt selama 3600 detik)
    "energy": {"base": "J", "units": {"J": 1.0, "kJ": 1e3, "Wh": 3600.0, "kWh": 3.6e6}},
}

# Cara lain menulis satuan yang boleh dipakai pengguna (misalnya di keyboard biasa).
ALIASES = {
    "uA": f"{MICRO}A",
    "uF": f"{MICRO}F",
    "us": f"{MICRO}s",
    "ohm": OHM,
    "Ohm": OHM,
    "kohm": f"k{OHM}",
    "kOhm": f"k{OHM}",
    "Mohm": f"M{OHM}",
    "MOhm": f"M{OHM}",
}

# Nama field hasil -> jenis besaran, dipakai untuk memformat tampilan.
FIELD_QUANTITY = {
    "voltage": "voltage",
    "current": "current",
    "resistance": "resistance",
    "power": "power",
    "capacitance": "capacitance",
    "time_constant": "time",
    "time": "time",
    "energy": "energy",
}

_PREFIXES = [
    (1e9, "G"), (1e6, "M"), (1e3, "k"), (1.0, ""),
    (1e-3, "m"), (1e-6, MICRO), (1e-9, "n"), (1e-12, "p"),
]
# Untuk detik, awalan di atas 1 (ks, Ms) tidak lazim dipakai.
_TIME_PREFIXES = [(1.0, ""), (1e-3, "m"), (1e-6, MICRO), (1e-9, "n"), (1e-12, "p")]


def normalize_unit(unit):
    """Rapikan penulisan satuan dan ubah alias menjadi nama satuan resmi."""
    text = str(unit).strip()
    text = text.replace("\u03bc", MICRO)  # μ huruf Yunani -> µ micro
    text = text.replace("\u2126", OHM)  # Ω simbol ohm -> Ω huruf Yunani
    return ALIASES.get(text, text)


def _units_for(quantity):
    """Ambil tabel satuan untuk satu jenis besaran."""
    if not isinstance(quantity, str) or quantity not in UNITS:
        raise CalculationError("Unknown quantity.")
    return UNITS[quantity]["units"]


def to_base(value, unit, quantity):
    """Ubah nilai dalam satuan tertentu ke satuan dasar (V, A, Ω, W, F)."""
    table = _units_for(quantity)
    unit = normalize_unit(unit)
    if unit not in table:
        raise CalculationError(f"Unknown unit '{unit}' for {quantity}.")
    return value * table[unit]


def format_plain(value, digits=6):
    """Tulis angka tanpa notasi ilmiah (1e-06 menjadi 0.000001)."""
    text = f"{value:.{digits}g}"
    if "e" in text:
        text = format(Decimal(text), "f")
    return text


def format_value(value, base_unit):
    """Tulis nilai dengan awalan satuan yang pas, misalnya 0.012 A -> '12 mA'."""
    if value == 0:
        return f"0 {base_unit}"
    # Bulatkan dulu agar selisih kecil dari perhitungan desimal tidak
    # mengacaukan pemilihan awalan (0.9999999999999999 dianggap 1).
    value = float(f"{value:.12g}")
    prefixes = _TIME_PREFIXES if base_unit == "s" else _PREFIXES
    magnitude = abs(value)
    factor, prefix = prefixes[-1]
    for candidate_factor, candidate_prefix in prefixes:
        if magnitude >= candidate_factor:
            factor, prefix = candidate_factor, candidate_prefix
            break
    return f"{format_plain(value / factor, 4)} {prefix}{base_unit}"


def format_field(field, value):
    """Format nilai berdasarkan nama field, misalnya ('current', 0.012)."""
    base = UNITS[FIELD_QUANTITY[field]]["base"]
    return format_value(value, base)


def convert_units(quantity, value, from_unit, to_unit):
    """Konversi nilai antar satuan pada besaran yang sama."""
    table = _units_for(quantity)
    from_unit = normalize_unit(from_unit)
    to_unit = normalize_unit(to_unit)
    for unit in (from_unit, to_unit):
        if unit not in table:
            raise CalculationError(f"Unknown unit '{unit}' for {quantity}.")

    ratio = table[from_unit] / table[to_unit]
    converted = value * ratio
    return {
        "value": converted,
        "unit": to_unit,
        "display": f"{format_plain(converted)} {to_unit}",
        "formula": f"1 {from_unit} = {format_plain(ratio)} {to_unit}",
        "working": f"{format_plain(value)} {from_unit} = {format_plain(converted)} {to_unit}",
    }


def unit_options():
    """Daftar satuan per besaran (urut dari kecil ke besar), untuk dropdown."""
    options = {}
    for quantity, info in UNITS.items():
        for quantity, info in UNITS.items():
            names = sorted(info["units"], key=lambda name: info["units"][name])
            options[quantity] = {"base": info["base"], "units": names}
    return options