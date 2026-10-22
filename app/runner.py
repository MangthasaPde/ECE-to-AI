"""Best-effort resource limits for accidental runaway student code, not isolation."""
import resource
import sys
resource.setrlimit(resource.RLIMIT_CPU,(35,35))
resource.setrlimit(resource.RLIMIT_FSIZE,(4*1024*1024,4*1024*1024))
import pytest
raise SystemExit(pytest.main([sys.argv[1],'-q','--tb=short','--color=no','-p','no:cacheprovider']))
