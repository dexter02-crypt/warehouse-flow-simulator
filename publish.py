"""This project already exists. Initial repository creation is intentionally retired."""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys
from tools.check import run_checks, verify_integrity

ROOT = Path(__file__).resolve().parent


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--public', action='store_true', help='Retired: will refuse without running Git or GitHub commands')
    group.add_argument('--test', action='store_true', help='Run real local verification; performs no publication')
    args = parser.parse_args(argv)
    if args.public:
        print('REFUSED: warehouse-flow-simulator is already published. Review a normal update commit in your existing clone; do not recreate it.', file=sys.stderr)
        return 2
    try:
        if args.test:
            run_checks(ROOT)
        else:
            entries = verify_integrity(ROOT)
            print('Existing repository: dexter02-crypt/warehouse-flow-simulator')
            for name in sorted(entries):
                print(' ', name)
            print('READ-ONLY INVENTORY: no Git, GitHub, commit, push or repository creation.')
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        print(f'STOPPED: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
