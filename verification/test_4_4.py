from verification.support import load
import pytest

def module():
    return load('world4/level_4_4.py')

def test_container_recipe(tmp_path):
    from verification.support import validate_container
    validate_container(module().build_files(),tmp_path)
