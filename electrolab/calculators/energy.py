"""Energi listrik: E = P × t."""
from .common import check_positive, make_result
from .errors import CalculationError
from .units import format_field as fmt
from .units import format_value

JOULES_PER_WH = 3600  # 1 Wh = 3600 J


def solve_energy(power=None, time=None, energy=None):
    """Isi dua dari tiga nilai (P, t, E), nilai ketiga dihitung.

    Semua dalam satuan dasar: watt (W), detik (s), joule (J).
    """
    given = {"power": power, "time": time, "energy": energy}
    filled = {name: value for name, value in given.items() if value is not None}
    if len(filled) != 2:
        raise CalculationError("Fill in exactly two values and leave the third one empty.")
    for name, value in filled.items():
        check_positive(value, name.capitalize())

    if energy is None:
        energy = power * time
        solved_for, formula = "energy", "E = P × t"
        working = f"E = {fmt('power', power)} × {fmt('time', time)} = {fmt('energy', energy)}"
    elif power is None:
        power = energy / time
        solved_for, formula = "power", "P = E / t"
        working = f"P = {fmt('energy', energy)} / {fmt('time', time)} = {fmt('power', power)}"
    else:
        time = energy / power
        solved_for, formula = "time", "t = E / P"
        working = f"t = {fmt('energy', energy)} / {fmt('power', power)} = {fmt('time', time)}"

    values = {"power": power, "time": time, "energy": energy}
    result = make_result(values, formula, working, solved_for)
    # Tagihan listrik memakai Wh/kWh, jadi tampilkan juga energi dalam Wh.
    result["extras"] = [["Energy (Wh)", format_value(energy / JOULES_PER_WH, "Wh")]]
    return result