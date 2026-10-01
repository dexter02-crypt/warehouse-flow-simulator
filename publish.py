from __future__ import annotations
from pathlib import Path
import argparse, subprocess
ROOT=Path(__file__).resolve().parent
OWNER='dexter02-crypt'
REPO='warehouse-flow-simulator'
EXCLUDE={'.git','__pycache__','node_modules','outputs'}
def files():
    out=[]
    for x in sorted(ROOT.rglob('*')):
        if not x.is_file(): continue
        if any(part in EXCLUDE for part in x.parts) or x.suffix=='.pyc': continue
        out.append(x.relative_to(ROOT))
    return out
def preview():
    print(f'Target: {OWNER}/{REPO} PUBLIC')
    for x in files(): print(' ',x.as_posix())
    print('PREVIEW ONLY: no GitHub writes.')
def publish():
    preview()
    who=subprocess.check_output(['gh','api','user','--jq','.login'],text=True).strip()
    if who!=OWNER: raise SystemExit(f'Authenticated account {who!r}; expected {OWNER!r}.')
    exists=subprocess.run(['gh','repo','view',f'{OWNER}/{REPO}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if exists.returncode==0: raise SystemExit('Target repository already exists; refusing initial-publication path.')
    subprocess.run(['node','--test','tests/*.test.mjs'],cwd=ROOT,shell=True,check=True)
    expected=f'PUBLIC {OWNER}/{REPO}'
    if input(f'Type exactly {expected!r} to continue: ')!=expected: raise SystemExit('Cancelled.')
    if (ROOT/'.git').exists(): raise SystemExit('Prepared publisher expects a non-Git working copy.')
    subprocess.run(['git','init','-b','main'],cwd=ROOT,check=True)
    subprocess.run(['git','add','--',*[x.as_posix() for x in files()]],cwd=ROOT,check=True)
    subprocess.run(['git','diff','--cached','--check'],cwd=ROOT,check=True)
    subprocess.run(['git','commit','-m','Add warehouse flow simulator v1.0'],cwd=ROOT,check=True)
    subprocess.run(['gh','repo','create',f'{OWNER}/{REPO}','--public','--source=.','--remote=origin','--push'],cwd=ROOT,check=True)
    print(f'Published: https://github.com/{OWNER}/{REPO}')
ap=argparse.ArgumentParser();ap.add_argument('--public',action='store_true');args=ap.parse_args();publish() if args.public else preview()
