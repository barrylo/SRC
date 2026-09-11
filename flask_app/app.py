import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import deque
import threading
from datetime import datetime

app = Flask(__name__)
CORS(app)

# in-memory history (thread-safe)
history = deque(maxlen=5)
history_lock = threading.Lock()


def to_celsius(value, unit):
    u = (unit or '').lower()
    if u in ('c', 'celsius'):
        return value
    if u in ('f', 'fahrenheit'):
        return (value - 32) * 5.0 / 9.0
    if u in ('k', 'kelvin'):
        return value - 273.15
    raise ValueError(f'unsupported unit: {unit}')


def from_celsius(value, unit):
    u = (unit or '').lower()
    if u in ('c', 'celsius'):
        return value
    if u in ('f', 'fahrenheit'):
        return value * 9.0 / 5.0 + 32
    if u in ('k', 'kelvin'):
        return value + 273.15
    raise ValueError(f'unsupported unit: {unit}')


def convert_temperature(value, frm, to):
    c = to_celsius(value, frm)
    return from_celsius(c, to)


@app.route('/ping')
def ping():
    return 'pong'


@app.route('/convert', methods=['POST'])
def convert_route():
    data = request.get_json() or {}
    try:
        value = float(data.get('value'))
        frm = data.get('from')
        to = data.get('to')
        result = convert_temperature(value, frm, to)
        # record to history (most recent last)
        entry = {
            'value': value,
            'from': frm,
            'to': to,
            'result': result,
            'ts': datetime.utcnow().isoformat() + 'Z'
        }
        with history_lock:
            history.append(entry)
        return jsonify({ 'value': result })
    except Exception as e:
        return jsonify({ 'error': str(e) }), 400


@app.route('/history', methods=['GET'])
def history_route():
    with history_lock:
        items = list(history)
    return jsonify(items)


@app.route('/history/clear', methods=['POST'])
def history_clear():
    with history_lock:
        history.clear()
    return jsonify({'ok': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5000'))
    app.run(host='0.0.0.0', port=port)
