from verification.support import load
import pytest

def module():
    return load('world1/level_1_2.py')

@pytest.mark.parametrize("values,lo,hi,want", [([-3,0,2,5,8],0,5,[0,2,5]),([],0,1,[]),([2,2,1],2,2,[2,2]),([-2,-1,0],-2,-1,[-2,-1])])
def test_filter(values,lo,hi,want):
    original=values.copy()
    assert module().filter_signal(values,lo,hi)==want
    assert values==original, "Do not mutate the input samples"
def test_invalid_range():
    with pytest.raises(ValueError): module().filter_signal([1],5,1)
