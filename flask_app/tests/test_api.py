import pytest
from app import app


def test_convert_endpoint_success():
    client = app.test_client()
    resp = client.post('/convert', json={'value': 100, 'from': 'C', 'to': 'F'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'value' in data
    assert data['value'] == pytest.approx(212)


def test_convert_endpoint_bad_request():
    client = app.test_client()
    resp = client.post('/convert', json={'value': 'abc', 'from': 'X', 'to': 'Y'})
    assert resp.status_code == 400


def test_history_after_convert():
    client = app.test_client()
    # clear history
    client.post('/history/clear')
    resp = client.post('/convert', json={'value': 10, 'from': 'C', 'to': 'F'})
    assert resp.status_code == 200
    h = client.get('/history')
    assert h.status_code == 200
    data = h.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    last = data[-1]
    assert last['from'] == 'C'
    assert last['to'] == 'F'
    assert last['result'] == pytest.approx(50)
