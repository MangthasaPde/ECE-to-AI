import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app import main as game

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(game,'DATA',tmp_path/'data');game.DATA.mkdir()
    monkeypatch.setattr(game,'WORK',tmp_path/'workspace');game.WORK.mkdir()
    monkeypatch.setattr(game,'BUSY',False)
    return TestClient(game.app,headers={'X-Gauntlet':'local'})

def learn(client,id):
    r=client.post('/api/lesson/complete',json={'id':id});assert r.status_code==200,r.text

def trial(client,kind='level',target='1.1',wrong=()):
    if kind=='level': learn(client,target)
    r=client.post('/api/quiz/start',json={'kind':kind,'target':target});assert r.status_code==200,r.text
    t=r.json()
    for i in range(t['total']):
        private=game.read()['session'];q=private['questions'][i]
        choice=(q['answer']+1)%4 if i in wrong else q['answer']
        r=client.post('/api/quiz/answer',json={'session_id':t['id'],'index':i,'choice':choice})
        assert r.status_code==200,r.text
    return r.json()['state']

def test_locks_and_no_answer_leak(client):
    assert client.get('/').status_code==200
    assert client.post('/api/initialize',json={'id':'1.1'}).status_code==403
    assert client.post('/api/quiz/start',json={'kind':'level','target':'1.2'}).status_code==403
    assert client.post('/api/quiz/start',json={'kind':'gate','target':'1'}).status_code==403
    data=client.get('/api/curriculum').json()
    assert 'quiz' not in data['items'][0]
    assert client.post('/api/quiz/start',json={'kind':'level','target':'1.1'}).status_code==403
    assert client.post('/api/lesson/complete',json={'id':'1.2'}).status_code==403
    learn(client,'1.1');assert client.get('/api/curriculum').json()['items'][0]['lesson_done']
    r=client.post('/api/quiz/start',json={'kind':'level','target':'1.1'}).json()
    assert 'answer' not in r['question'] and 'explanation' not in r['question']

def test_mistakes_retry_and_duplicate_answers(client):
    s=trial(client,wrong=(0,));assert s['hp']==90 and '1.1' not in s['quiz_passed']
    s=trial(client);assert s['xp']==30 and s['combos']['1.1']==1.5
    assert trial(client)['xp']==30
    t=game.read()['session']
    assert client.post('/api/quiz/answer',json={'session_id':t['id'],'index':2,'choice':0}).status_code==409

def test_initialize_preserves_work_and_real_verification(client):
    trial(client)
    r=client.post('/api/initialize',json={'id':'1.1'});assert r.status_code==200
    p=Path(r.json()['path'])
    bad=client.post('/api/verify',json={'id':'1.1'}).json();assert not bad['passed']
    p.write_text('def format_telemetry(sensor_id,voltage,active):\n    status="ON" if active else "OFF"\n    return f"{sensor_id} | {voltage:.2f} V | {status}"\n')
    original=p.read_text();client.post('/api/initialize',json={'id':'1.1'});assert p.read_text()==original
    result=client.post('/api/verify',json={'id':'1.1'}).json()
    assert result['passed'],result['output']
    assert result['reward']==150
    assert client.post('/api/verify',json={'id':'1.1'}).json()['reward']==0
    assert client.get('/api/curriculum').json()['items'][1]['unlocked']

def test_gate_key_and_world_unlock(client,monkeypatch):
    s=game.read();s['completed']=[f'1.{n}' for n in range(1,5)];game.save(s)
    state=trial(client,'gate','1',wrong=(0,1));assert '1' in state['keys']
    assert client.post('/api/initialize',json={'id':'1.boss'}).status_code==200
    monkeypatch.setattr(game,'run_verification',lambda id:(True,'all tests pass'))
    r=client.post('/api/verify',json={'id':'1.boss'}).json()
    assert r['reward']==300 and r['state']['boss_hp']['1']==0
    learn(client,'2.1')
    assert client.post('/api/quiz/start',json={'kind':'level','target':'2.1'}).status_code==200

def test_old_save_counts_passed_quiz_as_lesson(client):
    s=game.initial();del s['lessons_read'];s['quiz_passed']=['1.1'];game.save(s)
    assert game.read()['lessons_read']==[]
    assert client.post('/api/quiz/start',json={'kind':'level','target':'1.1'}).status_code==200

def test_daily_reward_and_death_recovery(client):
    assert client.post('/api/quiz/start',json={'kind':'daily'}).status_code==403
    s=game.read();s['completed']=['1.1'];game.save(s)
    assert trial(client,'daily','')['xp']==50
    assert trial(client,'daily','')['xp']==50
    s=game.read();s['hp']=0;game.save(s)
    assert client.post('/api/quiz/start',json={'kind':'daily'}).status_code==409
    assert client.post('/api/recover',json={}).json()['hp']==100
    assert game.read()['xp']==50

def test_timer_origin_and_persistence(client):
    learn(client,'1.1')
    t=client.post('/api/quiz/start',json={'kind':'level','target':'1.1','timed':True}).json()
    s=game.read();s['session']['deadline']=1;game.save(s)
    assert client.post('/api/quiz/answer',json={'session_id':t['id'],'index':0,'choice':0}).status_code==409
    assert client.post('/api/recover',json={},headers={'Origin':'https://evil.example'}).status_code==403
    assert TestClient(game.app).post('/api/recover',json={}).status_code==403
    assert client.get('/api/export').json()['session']['finished']
    assert client.get('/api/state').json()['hp']==100

def test_content_complete():
    assert len(game.CUR['levels'])==16 and len(game.BOSSES)==4
    for level in game.CUR['levels']:
        assert len(level['quiz'])==3
        assert len(level['quiz'][0]['code'].splitlines())==4
        assert [q['kind'] for q in level['quiz']][:2]==['Predict the Output','Spot the Bug']
        for q in level['quiz']: assert len(q['options'])==4 and 0<=q['answer']<4
    for w,questions in game.CUR['gatekeepers'].items(): assert len(questions)==10
    for level in game.CUR['levels']:
        pages=game.LESSONS[level['id']]['pages'];assert len(pages)>=4
        assert any(p.get('type')=='check' for p in pages)
        for p in pages:
            if p.get('type')=='check': assert 0<=p['answer']<len(p['options']) and p['explain']
            else: assert p['title'] and p['body']
    for id,item in game.ITEMS.items():
        assert (game.ROOT/'templates'/item['path']).is_file()
        assert (game.ROOT/'verification'/('test_'+id.replace('.','_')+'.py')).is_file()
