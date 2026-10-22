import json, sqlite3
from fastapi.testclient import TestClient
from verification.support import load

def test_api(tmp_path):
    calls=[]
    def llm(text): calls.append(text); return {"intent":"question","sentiment":"neutral"}
    db=tmp_path/"api.db"; c=TestClient(load("world2_boss/server.py").create_app(str(db),llm))
    r=c.post("/analyze",json={"text":"What is ADC?"})
    assert r.status_code==200 and r.json()=={"intent":"question","sentiment":"neutral"}
    assert calls==["What is ADC?"]
    for payload in [{},{"text":"  "},{"text":"x"*4001}]: assert c.post("/analyze",json=payload).status_code==422
    with sqlite3.connect(db) as con: rows=con.execute("SELECT text,response FROM analyses").fetchall()
    assert len(rows)==1 and rows[0][0]=="What is ADC?" and json.loads(rows[0][1])==r.json()

def test_failure(tmp_path):
    for response in [{},{"intent":"x","sentiment":"invented"}]:
        c=TestClient(load("world2_boss/server.py").create_app(str(tmp_path/"bad.db"),lambda text:response))
        assert c.post("/analyze",json={"text":"hello"}).status_code==502
    def fail(text): raise RuntimeError("offline")
    c=TestClient(load("world2_boss/server.py").create_app(str(tmp_path/"fail.db"),fail))
    assert c.post("/analyze",json={"text":"hello"}).status_code==502

def test_default_llm_adapter(tmp_path,monkeypatch):
    import gauntlet_ai
    seen=[]
    def generate(prompt): seen.append(prompt); return {'intent':'question','sentiment':'neutral'}
    monkeypatch.setattr(gauntlet_ai,'generate_json',generate)
    c=TestClient(load('world2_boss/server.py').create_app(str(tmp_path/'default.db')))
    assert c.post('/analyze',json={'text':'ADC meaning?'}).status_code==200
    assert seen and 'ADC meaning?' in seen[0]
