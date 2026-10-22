from verification.support import load
import pytest

def module():
    return load('world2/level_2_2.py')

def test_post():
    from fastapi.testclient import TestClient
    c=TestClient(module().app)
    r=c.post("/samples",json={"name":"A","voltage":3}); assert r.status_code==201; assert r.json()=={"name":"A","voltage":3}
    for data in [{},{"name":"","voltage":3},{"name":"A","voltage":6},{"name":"A","voltage":-1}]:
        assert c.post("/samples",json=data).status_code==422
