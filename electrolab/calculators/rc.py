"""Konstanta waktu RC: τ = R × C."""
from .common import check_positive, make_result
from .units import format_field as fmt


def calculate_rc(resistance, capacitance):
    """Hitung konstanta waktu dalam detik. Input dalam satuan dasar (Ω, F)."""
    check_positive(resistance, "Resistance")
    check_positive(capacitance, "Capacitance")

    tau = resistance * capacitance
    values = {"resistance": resistance, "capacitance": capacitance, "time_constant": tau}
    working = f"τ = {fmt('resistance', resistance)} × {fmt('capacitance', capacitance)} = {fmt('time_constant', tau)}"
    return make_result(values, "τ = R × C", working, "time_constant")