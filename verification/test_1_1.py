from verification.support import load
import pytest

def module():
    return load('world1/level_1_1.py')

@pytest.mark.parametrize("sensor,v,on,want", [("ADC-1",3.3,True,"ADC-1 | 3.30 V | ON"),("TEMP",0,False,"TEMP | 0.00 V | OFF"),("DIFF",-1.256,True,"DIFF | -1.26 V | ON"),("A",12.999,False,"A | 13.00 V | OFF")])
def test_telemetry(sensor,v,on,want):
    assert module().format_telemetry(sensor,v,on)==want
