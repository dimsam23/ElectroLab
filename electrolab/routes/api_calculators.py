"""Endpoint API untuk kalkulator elektronika.

Format input: setiap nilai dikirim sebagai {"value": "12", "unit": "V"}.
Konversi satuan dilakukan di Python (calculators/units.py), jadi
JavaScript tidak perlu mengulang logika satuan.
"""
from flask import Blueprint, jsonify, request

from ..calculators import color_code, energy, ohm, power, rc, resistor, units
from ..calculators.common import parse_number
from ..calculators.errors import CalculationError

api_calculators_bp = Blueprint(
    "api_calculators", __name__, url_prefix="/api/calculators"
)


def _read_item(item, label, quantity):
    """Baca satu input {"value", "unit"} dan ubah ke satuan dasar.

    Mengembalikan None kalau kolom dibiarkan kosong.
    """
    if item is None:
        return None
    if not isinstance(item, dict):
        raise CalculationError(f"Invalid input for {label}.")
    raw = item.get("value")
    if raw is None or str(raw).strip() == "":
        return None
    value = parse_number(raw, label)
    unit = item.get("unit") or units.UNITS[quantity]["base"]
    return units.to_base(value, unit, quantity)


def _read(data, field, quantity):
    """Baca field bernama dari body JSON."""
    return _read_item(data.get(field), field.capitalize(), quantity)


def _read_resistors(data):
    """Baca daftar resistor untuk seri/paralel (kolom kosong dilewati)."""
    items = data.get("resistors")
    if not isinstance(items, list):
        raise CalculationError("Send a list of resistors.")
    values = []
    for index, item in enumerate(items, start=1):
        value = _read_item(item, f"R{index}", "resistance")
        if value is not None:
            values.append(value)
    return values


def _run(calculation):
    """Jalankan fungsi perhitungan dan ubah hasilnya menjadi respons JSON."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(ok=False, error="Request body must be JSON."), 400
    try:
        result = calculation(data)
    except CalculationError as error:
        return jsonify(ok=False, error=str(error)), 400
    return jsonify(ok=True, result=result)


@api_calculators_bp.get("/options")
def options():
    """Daftar satuan dan warna untuk mengisi dropdown di halaman."""
    return jsonify(
        ok=True,
        result={"units": units.unit_options(), "colors": color_code.color_options()},
    )


@api_calculators_bp.post("/ohm")
def ohm_law():
    return _run(
        lambda d: ohm.solve_ohm(
            voltage=_read(d, "voltage", "voltage"),
            current=_read(d, "current", "current"),
            resistance=_read(d, "resistance", "resistance"),
        )
    )


@api_calculators_bp.post("/resistor")
def resistor_calc():
    def calculate(d):
        resistance = _read(d, "resistance", "resistance")
        voltage = _read(d, "voltage", "voltage")
        return resistor.calculate_resistor(resistance, voltage)

    return _run(calculate)


@api_calculators_bp.post("/series")
def series():
    return _run(lambda d: resistor.series_resistance(_read_resistors(d)))


@api_calculators_bp.post("/parallel")
def parallel():
    return _run(lambda d: resistor.parallel_resistance(_read_resistors(d)))


@api_calculators_bp.post("/power")
def power_calc():
    return _run(
        lambda d: power.solve_power(
            power=_read(d, "power", "power"),
            voltage=_read(d, "voltage", "voltage"),
            current=_read(d, "current", "current"),
            resistance=_read(d, "resistance", "resistance"),
        )
    )

@api_calculators_bp.post("/energy")
def energy_calc():
    return _run(
        lambda d: energy.solve_energy(
            power=_read(d, "power", "power"),
            time=_read(d, "time", "time"),
            energy=_read(d, "energy", "energy"),
        )
    )

@api_calculators_bp.post("/convert")
def convert():
    def calculate(d):
        value = parse_number(d.get("value"), "Value")
        return units.convert_units(d.get("quantity"), value, d.get("from"), d.get("to"))

    return _run(calculate)


@api_calculators_bp.post("/color-code")
def color_code_calc():
    return _run(
        lambda d: color_code.decode_color_code(
            d.get("band1"), 
            d.get("band2"), 
            d.get("band3", "none"), 
            d.get("multiplier"), 
            d.get("tolerance", "none")
        )
    )


@api_calculators_bp.post("/rc")
def rc_calc():
    def calculate(d):
        resistance = _read(d, "resistance", "resistance")
        capacitance = _read(d, "capacitance", "capacitance")
        return rc.calculate_rc(resistance, capacitance)

    return _run(calculate)