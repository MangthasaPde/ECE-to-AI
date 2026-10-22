import pytest
from verification.support import load

def test_rag(tmp_path):
    docs=["ADC digitizes voltages.","PWM varies duty cycle.","Filter removes noise.","Antenna radiates waves."]
    p=tmp_path/"doc.txt";p.write_text("\n\n".join(docs)); calls=[]
    vectors={docs[0]:[1.,0.],docs[1]:[.8,.2],docs[2]:[.5,.5],docs[3]:[-1.,0.],"ADC?":[1.,0.]}
    def embed(texts): return [vectors[t] for t in texts]
    def generate(question,sources):
        calls.append(sources)
        return {"answer":"ADC digitizes voltages.","citations":[{"id":sources[0]["id"],"quote":sources[0]["text"]}]}
    m=load("world3_boss/rag_engine.py")
    result=m.answer_question(str(p),"ADC?",str(tmp_path/"vectors"),embed,generate)
    assert result["answer"]==docs[0]
    assert [s["text"] for s in calls[0]]==docs[:3]
    assert [s["id"] for s in calls[0]]==["chunk-0","chunk-1","chunk-2"]
    for bad in [{"answer":"x","citations":[{"id":"fake","quote":"x"}]},{"answer":"x","citations":[{"id":"chunk-0","quote":"invented"}]}]:
        with pytest.raises(ValueError): m.answer_question(str(p),"ADC?",str(tmp_path/"vectors"),embed,lambda q,s:bad)
