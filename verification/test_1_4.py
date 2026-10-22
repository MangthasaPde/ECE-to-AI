from verification.support import load
import pytest

def module():
    return load('world1/level_1_4.py')

from types import SimpleNamespace

def test_secure_call(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","test-key")
    monkeypatch.setenv("GEMINI_MODEL","test-model")
    calls=[]
    def generate(**kwargs):
        calls.append(kwargs); return SimpleNamespace(text="ADC explanation")
    client=SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    assert module().secure_generate("Explain ADC",client)=="ADC explanation"
    assert calls==[{"model":"test-model","contents":"Explain ADC"}]
@pytest.mark.parametrize("missing",["GEMINI_API_KEY","GEMINI_MODEL"])
def test_missing_env(monkeypatch,missing):
    monkeypatch.setenv("GEMINI_API_KEY","test-key");monkeypatch.setenv("GEMINI_MODEL","test-model")
    monkeypatch.delenv(missing,raising=False)
    with pytest.raises(ValueError): module().secure_generate("hello",object())
def test_blank_prompt(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k");monkeypatch.setenv("GEMINI_MODEL","m")
    with pytest.raises(ValueError): module().secure_generate("  ",object())
def test_empty_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k");monkeypatch.setenv("GEMINI_MODEL","m")
    fake=SimpleNamespace(models=SimpleNamespace(generate_content=lambda **kw:SimpleNamespace(text=None)))
    with pytest.raises(ValueError): module().secure_generate("hello",fake)
def test_network_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k");monkeypatch.setenv("GEMINI_MODEL","m")
    def fail(**kw): raise RuntimeError("network unavailable")
    with pytest.raises(RuntimeError): module().secure_generate("hello",SimpleNamespace(models=SimpleNamespace(generate_content=fail)))

def test_live_client_branch(monkeypatch):
    from google import genai
    monkeypatch.setenv('GEMINI_API_KEY','test-only-key')
    monkeypatch.setenv('GEMINI_MODEL','test-model')
    calls=[]
    fake=SimpleNamespace(models=SimpleNamespace(generate_content=lambda **kw:SimpleNamespace(text='live-shaped reply')))
    def make(**kwargs): calls.append(kwargs); return fake
    monkeypatch.setattr(genai,'Client',make)
    assert module().secure_generate('Explain ADC')=='live-shaped reply'
    assert calls==[{'api_key':'test-only-key'}]
