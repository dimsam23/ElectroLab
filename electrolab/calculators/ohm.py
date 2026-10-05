"""Hukum Ohm: V = I × R."""
from .common import check_positive, make_result
from .errors import CalculationError
from .units import format_field as fmt


def solve_ohm(voltage=None, current=None, resistance=None):
    """Isi dua nilai, nilai ketiga dihitung. Semua dalam satuan dasar (V, A, Ω)."""
    given = {"voltage": voltage, "current": current, "resistance": resistance}
    filled = {name: value for name, value in given.items() if value is not None}
    if len(filled) != 2:
        raise CalculationError("Fill in exactly two values and leave the third one empty.")
    for name, value in filled.items():
        check_positive(value, name.capitalize())

    if current is None:
        current = voltage / resistance
        solved_for, formula = "current", "I = V / R"
        working = f"I = {fmt('voltage', voltage)} / {fmt('resistance', resistance)} = {fmt('current', current)}"
    elif voltage is None:
        voltage = current * resistance
        solved_for, formula = "voltage", "V = I × R"
        working = f"V = {fmt('current', current)} × {fmt('resistance', resistance)} = {fmt('voltage', voltage)}"
    else:
        resistance = voltage / current
        solved_for, formula = "resistance", "R = V / I"
        working = f"R = {fmt('voltage', voltage)} / {fmt('current', current)} = {fmt('resistance', resistance)}"

    values = {"voltage": voltage, "current": current, "resistance": resistance}
    return make_result(values, formula, working, solved_for)