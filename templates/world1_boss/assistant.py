import json
import os
from pathlib import Path

def summarize_file(input_path, output_path, client=None):
    raise NotImplementedError("Defeat the Scribe")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("input_path")
    parser.add_argument("output_path")
    args = parser.parse_args()
    summarize_file(args.input_path, args.output_path)
