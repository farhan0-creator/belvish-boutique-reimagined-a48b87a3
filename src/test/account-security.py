"""Read-only live security tests: python3 src/test/account-security.py."""
import json
import subprocess
from pathlib import Path

sql = '\n'.join(line for line in Path(__file__).with_suffix('.sql').read_text().splitlines() if not line.startswith('--'))
result = subprocess.run(['lovable', 'supabase', 'query', sql, '--json'], check=True, capture_output=True, text=True)
rows = json.loads(result.stdout)['rows']
assert len(rows) == 1, 'Security query must return one result'
for rule, passed in rows[0].items():
    assert passed is True, f'Security rule failed: {rule}'
    print(f'PASS {rule}')