"""Kode warna resistor (4 atau 5 gelang)."""
from .common import make_result
from .errors import CalculationError
from .units import format_field as fmt
from .units import format_plain

DIGITS = {
    "black": 0, "brown": 1, "red": 2, "orange": 3, "yellow": 4,
    "green": 5, "blue": 6, "violet": 7, "gray": 8, "white": 9,
}

MULTIPLIERS = {
    "black": 1, "brown": 10, "red": 100, "orange": 1_000, "yellow": 10_000,
    "green": 100_000, "blue": 1_000_000, "violet": 10_000_000,
    "gray": 100_000_000, "white": 1_000_000_000,
    "gold": 0.1, "silver": 0.01,
}

# Toleransi dalam persen. "none" berarti tidak ada gelang toleransi.
TOLERANCES = {
    "brown": 1.0, "red": 2.0, "green": 0.5, "blue": 0.25, "violet": 0.1,
    "gray": 0.05, "gold": 5.0, "silver": 10.0, "none": 20.0,
}

# Warna untuk menggambar resistor di halaman web.
HEX = {
    "black": "#111111", "brown": "#8b4513", "red": "#dc2626", "orange": "#f97316",
    "yellow": "#facc15", "green": "#16a34a", "blue": "#2563eb", "violet": "#7c3aed",
    "gray": "#9ca3af", "white": "#f8fafc", "gold": "#d4af37", "silver": "#c0c0c0",
}


def _clean(color):
    """Rapikan penulisan warna (huruf kecil, 'grey' = 'gray')."""
    text = str(color).strip().lower()
    return "gray" if text == "grey" else text


def decode_color_code(band1, band2, band3, multiplier, tolerance="none"):
    """Baca nilai hambatan dari warna gelang resistor (dukung 4 atau 5 gelang)."""
    band1, band2, band3 = _clean(band1), _clean(band2), _clean(band3)
    multiplier, tolerance = _clean(multiplier), _clean(tolerance)

    if band1 not in DIGITS or band1 == "black":
        raise CalculationError("Band 1 must be a digit color (brown to white).")
    if band2 not in DIGITS:
        raise CalculationError("Band 2 must be a digit color (black to white).")
    # Jika band3 "none", berarti 4 gelang.
    is_5_band = band3 != "none"
    if is_5_band and band3 not in DIGITS:
        raise CalculationError("Band 3 must be a digit color (black to white).")

    if multiplier not in MULTIPLIERS:
        raise CalculationError("Unknown multiplier color.")
    if tolerance not in TOLERANCES:
        raise CalculationError("Unknown tolerance color.")

    if is_5_band:
        digits = DIGITS[band1] * 100 + DIGITS[band2] * 10 + DIGITS[band3]
        resistance = digits * MULTIPLIERS[multiplier]
        working = (
            f"Band 1 ({band1}) = {DIGITS[band1]}, Band 2 ({band2}) = {DIGITS[band2]}, "
            f"Band 3 ({band3}) = {DIGITS[band3]}, Multiplier ({multiplier}) = ×{format_plain(MULTIPLIERS[multiplier])}. "
            f"{digits} × {format_plain(MULTIPLIERS[multiplier])} = {fmt('resistance', resistance)}"
        )
    else:
        digits = DIGITS[band1] * 10 + DIGITS[band2]
        resistance = digits * MULTIPLIERS[multiplier]
        working = (
            f"Band 1 ({band1}) = {DIGITS[band1]}, Band 2 ({band2}) = {DIGITS[band2]}, "
            f"Multiplier ({multiplier}) = ×{format_plain(MULTIPLIERS[multiplier])}. "
            f"{digits} × {format_plain(MULTIPLIERS[multiplier])} = {fmt('resistance', resistance)}"
        )

    percent = TOLERANCES[tolerance]
    low = resistance * (1 - percent / 100)
    high = resistance * (1 + percent / 100)

    result = make_result(
        {"resistance": resistance}, "R = (Digits) × Multiplier", working, "resistance"
    )
    result["tolerance_percent"] = percent
    result["tolerance_display"] = f"\u00b1{format_plain(percent)}%"
    result["range_display"] = f"{fmt('resistance', low)} to {fmt('resistance', high)}"
    
    bands = [band1, band2]
    if is_5_band:
        bands.append(band3)
    bands.append(multiplier)
    
    result["bands"] = [
        {"name": name, "hex": HEX[name]}
        for name in bands
    ]
    if tolerance != "none":
        result["bands"].append({"name": tolerance, "hex": HEX[tolerance]})
    return result


def color_options():
    """Daftar warna untuk dropdown di halaman web."""
    def build(table):
        return [{"name": name, "value": value, "hex": HEX.get(name)} for name, value in table.items()]

    return {
        "digits": build(DIGITS),
        "multipliers": [
            {**item, "label": "×" + format_plain(item["value"])}
            for item in build(MULTIPLIERS)
        ],
        "tolerances": [
            {**item, "label": f"\u00b1{format_plain(item['value'])}%"}
            for item in build(TOLERANCES)
        ],
    }