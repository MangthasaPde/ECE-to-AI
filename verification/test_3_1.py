from verification.support import load
import pytest

def module():
    return load('world3/level_3_1.py')

@pytest.mark.parametrize("text,size,overlap,want",[("ABCDEFG",4,1,["ABCD","DEFG"]),("ABCDE",3,0,["ABC","DE"]),("",3,1,[]),("AB",4,2,["AB"])])
def test_chunk(text,size,overlap,want):
    assert module().chunk_text(text,size,overlap)==want
@pytest.mark.parametrize("s,o",[(0,0),(3,3),(3,-1)])
def test_invalid(s,o):
    with pytest.raises(ValueError): module().chunk_text("abc",s,o)
