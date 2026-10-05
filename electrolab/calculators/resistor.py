"""Kalkulator resistor: arus & daya, rangkaian seri, dan rangkaian paralel."""
from .common import check_positive, make_result
from .errors import CalculationError
from .units import format_field as fmt

MAX_RESISTORS = 20


def calculate_resistor(resistance, voltage):
    """Dari hambatan dan tegangan, hitung arus dan daya."""
    check_positive(resistance, "Resistance")
    check_positive(voltage, "Voltage")

    current = voltage / resistance
    power = voltage * current  # sama dengan V² / R
    values = {
        "resistance": resistance,
        "voltage": voltage,
        "current": current,
        "power": power,
    }
    working = (
        f"I = {fmt('voltage', voltage)} / {fmt('resistance', resistance)} = {fmt('current', current)}; "
        f"P = {fmt('voltage', voltage)} × {fmt('current', current)} = {fmt('power', power)}"
    )
    return make_result(values, "I = V / R, P = V × I = V² / R", working)


def _check_resistors(resistances):
    """Validasi daftar resistor untuk seri/paralel."""
    if len(resistances) < 2:
        raise CalculationError("Enter at least two resistors.")
    if len(resistances) > MAX_RESISTORS:
        raise CalculationError(f"Use at most {MAX_RESISTORS} resistors.")
    for index, value in enumerate(resistances, start=1):
        check_positive(value, f"R{index}")


def series_resistance(resistances):
    """Rtotal = R1 + R2 + R3 + ..."""
    _check_resistors(resistances)
    total = sum(resistances)
    terms = " + ".join(fmt("resistance", r) for r in resistances)
    working = f"Rtotal = {terms} = {fmt('resistance', total)}"
    return make_result({"resistance": total}, "Rtotal = R1 + R2 + R3 + ...", working, "resistance")


def parallel_resistance(resistances):
    """1/Rtotal = 1/R1 + 1/R2 + 1/R3 + ..."""
    _check_resistors(resistances)
    total = 1 / sum(1 / r for r in resistances)
    inverses = " + ".join("1/" + fmt("resistance", r) for r in resistances)
    working = f"Rtotal = 1 / ({inverses}) = {fmt('resistance', total)}"
    return make_result(
        {"resistance": total}, "1/Rtotal = 1/R1 + 1/R2 + 1/R3 + ...", working, "resistance"
    )