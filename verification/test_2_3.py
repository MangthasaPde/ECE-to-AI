from verification.support import load
import pytest

def module():
    return load('world2/level_2_3.py')

def test_storage(tmp_path):
    import sqlite3
    p=str(tmp_path/"readings.db"); m=module()
    assert m.store_reading(p,"ADC",3.3)==1
    assert m.store_reading(p,"x'); DROP TABLE readings;--",2)==2
    with sqlite3.connect(p) as c:
        rows=c.execute("SELECT name,voltage FROM readings ORDER BY id").fetchall()
    assert rows[0]==("ADC",3.3); assert len(rows)==2
