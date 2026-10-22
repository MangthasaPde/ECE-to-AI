from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator
from pathlib import Path
import json

def create_app(decide=None):
    app = FastAPI()
    # TODO: implement the agent endpoint and serve index.html
    return app

app = create_app()
