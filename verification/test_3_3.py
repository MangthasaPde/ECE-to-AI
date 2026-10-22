from verification.support import load
import pytest

def module():
    return load('world3/level_3_3.py')

def test_chroma(tmp_path):
    m=module(); docs=["ADC digitizes","PWM controls duty","Antenna radiates"]
    result=m.search_chunks(str(tmp_path),docs,[[1.,0.],[0.,1.],[-1.,0.]],[1.,0.],2)
    assert result==docs[:2]
    assert m.search_chunks(str(tmp_path),docs,[[1.,0.],[0.,1.],[-1.,0.]],[1.,0.],9)==docs
