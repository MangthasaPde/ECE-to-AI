from verification.support import load
import pytest

def module():
    return load('world4/level_4_1.py')

def test_tools():
    m=module(); assert m.dispatch("add",{"a":2,"b":3})==5
    assert m.dispatch("lookup",{"key":"ADC"})=="analog-to-digital converter"
    assert m.dispatch("lookup",{"key":"X"})=="unknown"
    for name,args in [("exec",{}),("add",{"a":True,"b":2}),("add",{"a":1}),("lookup",{"key":5})]:
        with pytest.raises(ValueError): m.dispatch(name,args)
