"""Test logika kalkulator (tanpa Flask)."""
import pytest

from electrolab.calculators import color_code, energy, ohm, power, rc, resistor, units
from electrolab.calculators.errors import CalculationError

OHM = units.OHM
MICRO = units.MICRO


# ---------- Hukum Ohm ----------
def test_ohm_current():
    result = ohm.solve_ohm(voltage=12, resistance=1000)
    assert result["solved_for"] == "current"
    assert result["values"]["current"] == pytest.approx(0.012)
    assert result["display"]["current"] == "12 mA"
    assert result["formula"] == "I = V / R"


def test_ohm_voltage():
    result = ohm.solve_ohm(current=0.02, resistance=220)
    assert result["values"]["voltage"] == pytest.approx(4.4)


def test_ohm_resistance():
    result = ohm.solve_ohm(voltage=9, current=0.003)
    assert result["values"]["resistance"] == pytest.approx(3000)
    assert result["display"]["resistance"] == f"3 k{OHM}"


def test_ohm_needs_exactly_two_values():
    with pytest.raises(CalculationError):
        ohm.solve_ohm(voltage=12)
    with pytest.raises(CalculationError):
        ohm.solve_ohm(voltage=12, current=1, resistance=12)


def test_ohm_rejects_zero_and_negative():
    with pytest.raises(CalculationError):
        ohm.solve_ohm(voltage=12, resistance=0)
    with pytest.raises(CalculationError):
        ohm.solve_ohm(voltage=-5, resistance=100)


# ---------- Power ----------
@pytest.mark.parametrize(
    "given",
    [
        {"voltage": 12, "current": 0.5},
        {"voltage": 12, "resistance": 24},
        {"current": 0.5, "resistance": 24},
        {"power": 6, "voltage": 12},
        {"power": 6, "current": 0.5},
        {"power": 6, "resistance": 24},
    ],
)
def test_power_all_combinations(given):
    """Semua pasangan input harus menghasilkan rangkaian yang sama: 12 V, 0.5 A, 24 Ω, 6 W."""
    values = power.solve_power(**given)["values"]
    assert values["power"] == pytest.approx(6)
    assert values["voltage"] == pytest.approx(12)
    assert values["current"] == pytest.approx(0.5)
    assert values["resistance"] == pytest.approx(24)


def test_power_needs_exactly_two_values():
    with pytest.raises(CalculationError):
        power.solve_power(power=6)


# ---------- Resistor ----------
def test_resistor_current_and_power():
    result = resistor.calculate_resistor(resistance=1000, voltage=12)
    assert result["values"]["current"] == pytest.approx(0.012)
    assert result["values"]["power"] == pytest.approx(0.144)


def test_series():
    result = resistor.series_resistance([100, 220, 330])
    assert result["values"]["resistance"] == pytest.approx(650)
    assert result["display"]["resistance"] == f"650 {OHM}"


def test_parallel_two_equal_resistors():
    result = resistor.parallel_resistance([100, 100])
    assert result["values"]["resistance"] == pytest.approx(50)


def test_parallel_two_different_resistors():
    result = resistor.parallel_resistance([1000, 2000])
    assert result["values"]["resistance"] == pytest.approx(666.67, abs=0.01)


def test_series_parallel_need_two_resistors():
    with pytest.raises(CalculationError):
        resistor.series_resistance([100])
    with pytest.raises(CalculationError):
        resistor.parallel_resistance([])


# ---------- Satuan ----------
def test_convert_voltage():
    assert units.convert_units("voltage", 1500, "mV", "V")["value"] == pytest.approx(1.5)


def test_convert_resistance_with_alias():
    result = units.convert_units("resistance", 4.7, "kohm", OHM)
    assert result["value"] == pytest.approx(4700)


def test_convert_capacitance_with_alias():
    result = units.convert_units("capacitance", 100, "uF", "F")
    assert result["value"] == pytest.approx(1e-4)
    assert result["display"] == "0.0001 F"


def test_convert_unknown_unit():
    with pytest.raises(CalculationError):
        units.convert_units("voltage", 1, "mV", "banana")


def test_format_value():
    assert units.format_value(0.012, "A") == "12 mA"
    assert units.format_value(0, "V") == "0 V"
    assert units.format_value(2.2e-6, "F") == f"2.2 {MICRO}F"
    assert units.format_value(1000, "s") == "1000 s"
    # hasil 100 * 1e-6 * 10000 = 0.9999999999999999 harus tetap tampil 1 s
    assert units.format_value(0.9999999999999999, "s") == "1 s"


# ---------- Kode warna ----------
def test_color_code_1k_5_percent():
    result = color_code.decode_color_code("brown", "black", "red", "gold")
    assert result["values"]["resistance"] == pytest.approx(1000)
    assert result["tolerance_display"] == "\u00b15%"
    assert len(result["bands"]) == 4


def test_color_code_47k_10_percent():
    result = color_code.decode_color_code("yellow", "violet", "orange", "silver")
    assert result["values"]["resistance"] == pytest.approx(47000)


def test_color_code_rejects_black_first_band():
    with pytest.raises(CalculationError):
        color_code.decode_color_code("black", "brown", "red", "gold")


def test_color_code_unknown_color():
    with pytest.raises(CalculationError):
        color_code.decode_color_code("pink", "brown", "red", "gold")


# ---------- RC ----------
def test_rc_time_constant():
    result = rc.calculate_rc(resistance=10_000, capacitance=100e-6)
    assert result["values"]["time_constant"] == pytest.approx(1.0)
    assert result["display"]["time_constant"] == "1 s"


def test_rc_milliseconds():
    result = rc.calculate_rc(resistance=1000, capacitance=1e-6)
    assert result["display"]["time_constant"] == "1 ms"

# ---------- Energi ----------
def test_energy_from_power_and_time():
    """6 W selama 2 jam = 12 Wh = 43200 J."""
    result = energy.solve_energy(power=6, time=2 * 3600)
    assert result["solved_for"] == "energy"
    assert result["values"]["energy"] == pytest.approx(43200)
    assert result["display"]["energy"] == "43.2 kJ"
    assert result["extras"] == [["Energy (Wh)", "12 Wh"]]


def test_energy_solves_power_and_time():
    assert energy.solve_energy(energy=43200, time=7200)["values"]["power"] == pytest.approx(6)
    assert energy.solve_energy(energy=43200, power=6)["values"]["time"] == pytest.approx(7200)


def test_energy_kilowatt_hour():
    result = energy.solve_energy(power=1000, time=3600)
    assert result["values"]["energy"] == pytest.approx(3.6e6)
    assert result["extras"][0][1] == "1 kWh"


def test_energy_needs_exactly_two_values():
    with pytest.raises(CalculationError):
        energy.solve_energy(power=6)
    with pytest.raises(CalculationError):
        energy.solve_energy(power=6, time=1, energy=6)


def test_convert_time_and_energy_units():
    assert units.convert_units("time", 90, "min", "s")["value"] == pytest.approx(5400)
    assert units.convert_units("energy", 1, "kWh", "Wh")["value"] == pytest.approx(1000)
    assert units.convert_units("energy", 1, "Wh", "J")["value"] == pytest.approx(3600)