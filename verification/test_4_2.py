from verification.support import load
import pytest

def module():
    return load('world4/level_4_2.py')

def test_agent():
    m=module()
    def decide(h): return {"final":str(h[-1]["result"])} if h else {"tool":"add","args":{"a":2,"b":3}}
    assert m.run_agent(decide,{"add":lambda a,b:a+b})=="5"
    with pytest.raises(RuntimeError): m.run_agent(lambda h:{"tool":"add","args":{}},{"add":lambda:0},2)
    with pytest.raises(ValueError): m.run_agent(lambda h:{"tool":"shell","args":{}},{})
    with pytest.raises(ValueError): m.run_agent(decide,{},0)
