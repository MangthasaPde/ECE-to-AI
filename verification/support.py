import importlib.util
import os
import uuid
from pathlib import Path

def workspace():
    return Path(os.environ.get("GAUNTLET_WORKSPACE",Path(__file__).resolve().parents[1]/"workspace"))

def load(relative):
    path=workspace()/relative
    assert path.is_file(), f"Initialize the quest first: {path}"
    name="quest_"+uuid.uuid4().hex
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    import sys
    sys.modules[name]=module
    sys.path.insert(0,str(path.parent))
    try: spec.loader.exec_module(module)
    finally: sys.path.pop(0)
    return module

def validate_container(files,tmp_path,check_health=True):
    import ast, json
    d=files["Dockerfile"]
    for token in ["FROM python:3.12-slim","WORKDIR /app","COPY requirements.txt","pip install","-r requirements.txt","COPY . .","EXPOSE 8000","uvicorn","server:app","0.0.0.0","8000"]:
        assert token in d, f"Dockerfile missing {token}"
    assert d.index("COPY requirements.txt") < d.index("COPY . ."), "Cache dependencies before app source"
    for name in [".gitignore",".dockerignore"]:
        for token in [".env",".venv","__pycache__"]: assert token in files[name]
    for package in ["fastapi","uvicorn"]: assert package in files["requirements.txt"]
    ast.parse(files["server.py"])
    for name,content in files.items(): (tmp_path/name).write_text(content)
    if check_health:
        from fastapi.testclient import TestClient
        spec=importlib.util.spec_from_file_location("container_app",tmp_path/"server.py")
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        assert TestClient(m.app).get("/health").json()=={"ok":True}
        dest=workspace()/"world4/generated";dest.mkdir(parents=True,exist_ok=True)
        for name,content in files.items(): (dest/name).write_text(content)
