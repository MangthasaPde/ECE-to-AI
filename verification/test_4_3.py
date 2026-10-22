from verification.support import load
import pytest

def module():
    return load('world4/level_4_3.py')

def test_ui():
    from fastapi.testclient import TestClient
    c=TestClient(module().app); r=c.get("/"); assert r.status_code==200
    for s in ["<form","fetch(","/echo","textContent"]: assert s in r.text
    r=c.post("/echo",json={"text":"<b>hi</b>"}); assert r.status_code==200; assert r.json()=={"text":"<b>hi</b>"}
    assert c.post("/echo",json={"text":""}).status_code==422
