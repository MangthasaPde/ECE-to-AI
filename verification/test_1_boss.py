import json
import os
from types import SimpleNamespace
import pytest
from verification.support import load

def run(tmp_path, monkeypatch, payload):
    monkeypatch.setenv("GEMINI_MODEL","test-model")
    src=tmp_path/"input.txt"; src.write_text("ADC resolution controls quantization noise.")
    out=tmp_path/"result.json"; calls=[]
    def generate(**kw):
        calls.append(kw)
        return SimpleNamespace(text=payload)
    fake=SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    result=load("world1_boss/assistant.py").summarize_file(src,out,client=fake)
    return result,out,calls

def test_summary(tmp_path,monkeypatch):
    expected={"summary":"ADC resolution influences quantization noise.","keywords":["ADC","resolution","quantization","noise","sampling"]}
    result,out,calls=run(tmp_path,monkeypatch,json.dumps(expected))
    assert result==expected and json.loads(out.read_text())==expected
    assert len(calls)==1
    assert "ADC resolution controls quantization noise." in calls[0]["contents"]
    assert calls[0]["model"]=="test-model"
    assert calls[0]["config"]["response_mime_type"]=="application/json"

@pytest.mark.parametrize("payload",["not JSON",'{}','{"summary":"x","keywords":["one"]}','{"summary":"","keywords":["a","b","c","d","e"]}','{"summary":"x","keywords":["a","a","b","c","d"]}'])
def test_invalid_response(tmp_path,monkeypatch,payload):
    with pytest.raises(ValueError): run(tmp_path,monkeypatch,payload)
    assert not (tmp_path/"result.json").exists()

def test_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError): load("world1_boss/assistant.py").summarize_file(tmp_path/"missing",tmp_path/"out",object())

def test_empty_file(tmp_path):
    p=tmp_path/"empty";p.write_text("  ")
    with pytest.raises(ValueError): load("world1_boss/assistant.py").summarize_file(p,tmp_path/"out",object())

def test_cli_contract():
    import ast
    from verification.support import workspace
    tree=ast.parse((workspace()/"world1_boss/assistant.py").read_text())
    assert any(isinstance(n,ast.If) and "__name__" in ast.unparse(n.test) for n in ast.walk(tree)), "Provide a CLI guarded by __name__"

def test_cli_execution(tmp_path):
    """Run the actual CLI against a fake google-genai package; no network or real key."""
    import subprocess,sys
    from verification.support import workspace
    package=tmp_path/'google';package.mkdir();(package/'__init__.py').write_text('')
    expected={'summary':'ADC digitizes signals.','keywords':['ADC','signal','sampling','voltage','digital']}
    source='from types import SimpleNamespace\nclass Client:\n    def __init__(self, **kwargs):\n        self.models = self\n    def generate_content(self, **kwargs):\n        return SimpleNamespace(text='+repr(json.dumps(expected))+')\n'
    (package/'genai.py').write_text(source)
    inp=tmp_path/'source.txt';inp.write_text('ADC digitizes signals.')
    out=tmp_path/'result.json'
    env=dict(os.environ,PYTHONPATH=str(tmp_path),GEMINI_API_KEY='fake-cli-key',GEMINI_MODEL='test-model')
    result=subprocess.run([sys.executable,str(workspace()/'world1_boss/assistant.py'),str(inp),str(out)],env=env,cwd=tmp_path,capture_output=True,text=True,timeout=10)
    assert result.returncode==0,result.stderr
    assert json.loads(out.read_text())==expected
