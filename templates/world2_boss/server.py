from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
import sqlite3
import json
from pathlib import Path

def create_app(db_path, llm=None):
    app = FastAPI()
    # TODO: schema, table, route, model injection
    return app

app = create_app(str(Path(__file__).with_name("requests.db")))
