from verification.support import load
import pytest

def module():
    return load('world1/level_1_3.py')

def test_packet():
    import json
    raw=json.dumps({"device":{"id":"A"},"readings":[{"voltage":3},{"voltage":5}],"extra":1})
    assert module().restructure_payload(raw)=={"device_id":"A","voltages":[3,5],"average_voltage":4}
def test_empty():
    assert module().restructure_payload('{"device":{"id":"B"},"readings":[]}')=={"device_id":"B","voltages":[],"average_voltage":None}
@pytest.mark.parametrize("raw", ['oops','{}','[]','{"device":{"id":""},"readings":[]}','{"device":{"id":"A"},"readings":[{"voltage":"3"}]}','{"device":{"id":"A"},"readings":[{"voltage":true}]}','{"device":{"id":"A"},"readings":null}'])
def test_bad_packet(raw):
    with pytest.raises(ValueError): module().restructure_payload(raw)
