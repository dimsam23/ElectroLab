"""Fungsi bersama: parsing angka, validasi, dan format hasil."""
import math

from .errors import CalculationError
from .units import format_field


def parse_number(raw, label):
    """Ubah input (angka atau teks seperti '1,5') menjadi float yang valid."""
    if isinstance(raw, bool):
        raise CalculationError(f"{label} must be a number.")
    if isinstance(raw, str):
        raw = raw.strip().replace(",", ".")  # koma desimal gaya Indonesia
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise CalculationError(f"{label} must be a number.") from None
    if not math.isfinite(value):
        raise CalculationError(f"{label} must be a finite number.")
    return value


def check_positive(value, label):
    """Pastikan nilai lebih besar dari 0."""
    if value is None or not math.isfinite(value) or value <= 0:
        raise CalculationError(f"{label} must be greater than 0.")
    return value


def make_result(values, formula, working, solved_for=None):
    """Susun hasil standar: nilai asli, teks tampilan, rumus, dan langkah hitung."""
    for value in values.values():
        if not math.isfinite(value):
            raise CalculationError("The result is too large to calculate.")
    return {
        "solved_for": solved_for,
        "values": values,
        "display": {name: format_field(name, value) for name, value in values.items()},
        "formula": formula,
        "working": working,
    }