from fastapi.testclient import TestClient
from verification.support import load,workspace,validate_container

def test_agent_service():
    seen=[]
    def decide(question,history):
        seen.append(list(history))
        if not history: return {"tool":"search_docs","args":{"query":"ADC"}}
        if len(history)==1: return {"tool":"calculate","args":{"a":2,"b":3,"op":"+"}}
        return {"final":"ADC result: 5"}
    c=TestClient(load("world4_boss/server.py").create_app(decide))
    r=c.post("/agent",json={"question":"ADC plus 2 and 3?"})
    assert r.status_code==200 and r.json()=={"answer":"ADC result: 5","steps":2}
    assert seen[1][0]["result"] and "ADC" in str(seen[1][0]["result"])
    assert seen[2][1]["result"]==5
    assert c.post("/agent",json={"question":" "}).status_code==422
    assert c.post("/agent",json={"question":"x","max_steps":9}).status_code==422
    page=c.get("/"); assert page.status_code==200
    for token in ["<form","fetch(","/agent","textContent"]: assert token in page.text

def test_agent_limits():
    make=load("world4_boss/server.py").create_app
    c=TestClient(make(lambda q,h:{"tool":"shell","args":{}}))
    assert c.post("/agent",json={"question":"x"}).status_code==400
    c=TestClient(make(lambda q,h:{"tool":"calculate","args":{"a":1,"b":2,"op":"+"}}))
    assert c.post("/agent",json={"question":"x","max_steps":2}).status_code==508

def test_portfolio(tmp_path):
    folder=workspace()/"world4_boss"
    files={n:(folder/n).read_text() for n in ["Dockerfile",".gitignore",".dockerignore","requirements.txt","server.py"]}
    validate_container(files,tmp_path,check_health=False)
    assert len((folder/"README.md").read_text())>150, "Document setup, tools, limits and configuration"

def test_tools_use_real_inputs_and_local_docs():
    import json
    folder=workspace()/'world4_boss'
    corpus=json.loads((folder/'docs.json').read_text())
    assert isinstance(corpus,list) and corpus
    for tool,args,want in [('search_docs',{'query':'NO_MATCH_0938'},[]),('calculate',{'a':9,'b':4,'op':'-'},5),('calculate',{'a':3,'b':4,'op':'*'},12),('calculate',{'a':9,'b':3,'op':'/'},3)]:
        seen=[]
        def decide(q,h):
            if h: seen.append(h[-1]['result']);return {'final':'done'}
            return {'tool':tool,'args':args}
        c=TestClient(load('world4_boss/server.py').create_app(decide))
        assert c.post('/agent',json={'question':'test'}).status_code==200
        assert seen==[want]
    for args in [{'a':True,'b':1,'op':'+'},{'a':'x','b':1,'op':'+'},{'a':1,'b':1,'op':'exec'}]:
        c=TestClient(load('world4_boss/server.py').create_app(lambda q,h:{'tool':'calculate','args':args}))
        assert c.post('/agent',json={'question':'test'}).status_code==400
