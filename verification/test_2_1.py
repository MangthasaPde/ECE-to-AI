from verification.support import load
import pytest

def module():
    return load('world2/level_2_1.py')

def test_get():
    from fastapi.testclient import TestClient
    c=TestClient(module().app)
    for name in ["ADC","TEMP"]:
        r=c.get("/sensor/"+name); assert r.status_code==200; assert r.json()=={"id":name,"voltage":3.3}
    assert c.get("/missing").status_code==404
