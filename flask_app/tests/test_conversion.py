import pytest
from app import to_celsius, from_celsius, convert_temperature


def test_to_celsius_fahrenheit():
    assert to_celsius(32, 'F') == pytest.approx(0)


def test_from_celsius_fahrenheit():
    assert from_celsius(0, 'F') == pytest.approx(32)


def test_convert_c_to_f():
    assert convert_temperature(100, 'C', 'F') == pytest.approx(212)


def test_convert_k_to_c():
    assert convert_temperature(273.15, 'K', 'C') == pytest.approx(0)


def test_roundtrip():
    v = 25.5
    assert convert_temperature(convert_temperature(v, 'C', 'F'), 'F', 'C') == pytest.approx(v, rel=1e-6)
