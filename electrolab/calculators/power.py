"""Kalkulator daya: P = V × I, P = I² × R, P = V² / R."""
import math

from .common import check_positive, make_result
from .errors import CalculationError
from .units import format_field as fmt

SYMBOLS = {"power": "P", "voltage": "V", "current": "I", "resistance": "R"}


def solve_power(power=None, voltage=None, current=None, resistance=None):
    """Isi dua dari empat nilai (P, V, I, R), dua lainnya dihitung."""
    given = {"power": power, "voltage": voltage, "current": current, "resistance": resistance}
    filled = {name: value for name, value in given.items() if value is not None}
    if len(filled) != 2:
        raise CalculationError("Fill in exactly two values and leave the others empty.")
    for name, value in filled.items():
        check_positive(value, name.capitalize())

    names = set(filled)
    if names == {"voltage", "current"}:
        power = voltage * current
        resistance = voltage / current
        formula = "P = V × I, R = V / I"
    elif names == {"voltage", "resistance"}:
        current = voltage / resistance
        power = voltage ** 2 / resistance
        formula = "I = V / R, P = V² / R"
    elif names == {"current", "resistance"}:
        voltage = current * resistance
        power = current ** 2 * resistance
        formula = "V = I × R, P = I² × R"
    elif names == {"power", "voltage"}:
        current = power / voltage
        resistance = voltage ** 2 / power
        formula = "I = P / V, R = V² / P"
    elif names == {"power", "current"}:
        voltage = power / current
        resistance = power / current ** 2
        formula = "V = P / I, R = P / I²"
    else:  # power dan resistance
        voltage = math.sqrt(power * resistance)
        current = math.sqrt(power / resistance)
        formula = "V = √(P × R), I = √(P / R)"

    values = {"power": power, "voltage": voltage, "current": current, "resistance": resistance}
    known = ", ".join(f"{SYMBOLS[n]} = {fmt(n, values[n])}" for n in filled)
    found = ", ".join(f"{SYMBOLS[n]} = {fmt(n, values[n])}" for n in values if n not in filled)
    return make_result(values, formula, f"Given {known}. Result: {found}.")