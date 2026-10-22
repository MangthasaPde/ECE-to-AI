from verification.support import load
import pytest

def module():
    return load('world3/level_3_2.py')

@pytest.mark.parametrize("a,b,want",[([1,0],[1,0],1),([1,0],[0,1],0),([1,2],[-1,-2],-1),([0,0],[1,1],0),([1,1],[2,0],2**-.5)])
def test_cos(a,b,want):
    assert module().cosine(a,b)==pytest.approx(want)
@pytest.mark.parametrize("a,b",[([],[]),([1],[1,2])])
def test_dimension(a,b):
    with pytest.raises(ValueError): module().cosine(a,b)
