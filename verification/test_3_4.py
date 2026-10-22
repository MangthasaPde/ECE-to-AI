from verification.support import load
import pytest

def module():
    return load('world3/level_3_4.py')

def test_grounding():
    m=module(); s=[{"id":"s1","text":"ADC digitizes analog signals"}]
    p=m.grounded_prompt("What is ADC?",s)
    for word in ["What is ADC?","[s1]",s[0]["text"],"only","insufficient","json"]: assert word.lower() in p.lower()
    a={"answer":"It digitizes","citations":["s1"]}; assert m.validate_answer(a,s)==a
    for bad in [{"answer":"x","citations":["fake"]},{"answer":"","citations":["s1"]},{"answer":"x","citations":[]},{}]:
        with pytest.raises(ValueError): m.validate_answer(bad,s)
