"""Run actual Node test files and Python tooling tests, without a shell."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def verify_integrity(root: Path = ROOT) -> dict[str, str]:
    entries = json.loads((root / 'INTEGRITY.json').read_text(encoding='utf-8'))
    if not isinstance(entries, dict) or not entries:
        raise ValueError('Missing integrity inventory')
    for name, expected in entries.items():
        if not isinstance(name, str) or not isinstance(expected, str) or not name:
            raise ValueError('Unsafe integrity record')
        rel = PurePosixPath(name)
        if (rel.is_absolute() or any(part in ('.', '..', '.git') for part in rel.parts) or '\\' in name or name != rel.as_posix() or
                not re.fullmatch(r'[0-9a-f]{64}', expected)):
            raise ValueError('Unsafe integrity record')
        path = root
        for part in rel.parts:
            path = path / part
            if path.is_symlink():
                raise ValueError(f'Symlink refused: {name}')
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Integrity mismatch: {name}')
    # A verified test run must not discover additional unreviewed executable source.
    for folder in ['src', 'tests', 'tools']:
        for path in (root / folder).rglob('*'):
            if '__pycache__' in path.parts or path.suffix == '.pyc' or path.name == '.DS_Store':
                continue
            if path.is_symlink():
                raise ValueError(f'Symlink refused: {path.relative_to(root)}')
            if path.is_file() and path.relative_to(root).as_posix() not in entries:
                raise ValueError(f'Unlisted source/test file: {path.relative_to(root)}')
    return entries


def node_test_command(root: Path = ROOT) -> list[str]:
    files = sorted((root / 'tests').glob('*.test.mjs'))
    if not files or any(p.is_symlink() or not p.is_file() for p in files):
        raise ValueError('No regular Node test files were found')
    return ['node', '--test', '--test-reporter=tap', *[p.relative_to(root).as_posix() for p in files]]


def clean_environment() -> dict[str, str]:
    env = dict(os.environ)
    for name in ['NODE_OPTIONS', 'NODE_PATH', 'NODE_TEST_CONTEXT']:
        env.pop(name, None)
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    return env


def run_node_tests(root: Path = ROOT) -> None:
    subprocess.run(node_test_command(root), cwd=root, check=True, shell=False,
                   stdin=subprocess.DEVNULL, timeout=120, env=clean_environment())


def run_checks(root: Path = ROOT, integrity: bool = True) -> None:
    if integrity:
        print(f'Integrity verified: {len(verify_integrity(root))} payloads.', flush=True)
    version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True,
                             stdin=subprocess.DEVNULL, timeout=10, env=clean_environment()).stdout.strip()
    match = re.fullmatch(r'v(\d+)\..*', version)
    if not match or int(match[1]) < 22:
        raise ValueError('Node.js 22 or later is required; no dependency installation is performed.')
    for path in sorted([*(root / 'src').rglob('*.js'), *(root / 'tests').glob('*.mjs'), *(root / 'tools').glob('*.mjs')]):
        subprocess.run(['node', '--check', str(path)], check=True, cwd=root,
                       stdin=subprocess.DEVNULL, timeout=10, env=clean_environment())
    run_node_tests(root)
    subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v'],
                   cwd=root, check=True, shell=False, stdin=subprocess.DEVNULL,
                   timeout=120, env=clean_environment())
    if integrity:
        verify_integrity(root)
    identity = 'source identity, ' if integrity else ''
    print(f'CHECKS PASSED: {identity}JavaScript syntax, Node tests and Python tooling tests.', flush=True)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--verify-only', action='store_true')
    p.add_argument('--development', action='store_true', help='Run changed-source tests without claiming package identity')
    args = p.parse_args(argv)
    try:
        if args.verify_only:
            print(f'Integrity verified: {len(verify_integrity())} payloads.')
        else:
            run_checks(integrity=not args.development)
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        print(f'CHECK FAILED: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
