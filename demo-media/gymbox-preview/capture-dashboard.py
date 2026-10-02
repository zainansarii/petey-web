"""Build and capture actual dashboard snapshot with pinned Hyperframes CLI."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess
ROOT=Path(__file__).resolve().parent
node=os.environ.get('NODE') or shutil.which('node')
ff=os.environ.get('FFMPEG') or shutil.which('ffmpeg')
cli=next((p for p in [ROOT/'node_modules/hyperframes/bin/hyperframes.mjs',ROOT/'tools/node_modules/hyperframes/bin/hyperframes.mjs'] if p.exists()),None)
if not node or not ff or not cli:raise SystemExit('Requires Node 22+, FFmpeg and installed Hyperframes.')
subprocess.run([node,str(ROOT/'dashboard-source/build.mjs')],cwd=ROOT,check=True)
qa=ROOT/'qa';qa.mkdir(exist_ok=True);ui=ROOT/'composition/assets/ui';ui.mkdir(exist_ok=True)
files={'overview':'admin-overview-new.jpg','trainers':'admin-trainers-new.jpg','emma':'admin-emma-new.jpg','emma-bottom':'admin-emma-bottom.jpg'}
records=[]
for route,name in files.items():
    shot=qa/('capture-'+route);shot.mkdir(exist_ok=True)
    result=subprocess.run([node,str(cli),'snapshot',str(ROOT/'dashboard-source'/('capture-'+route)),'--output',str(shot),'--at','0','--no-end','--describe','false'],cwd=ROOT,check=True,capture_output=True,text=True)
    (qa/('capture-'+route+'.log')).write_text(result.stdout+result.stderr)
    pngs=sorted(shot.rglob('*.png'))
    if len(pngs)!=1:raise SystemExit(f'{route}: expected 1 PNG, got {len(pngs)}')
    subprocess.run([ff,'-y','-v','error','-i',str(pngs[0]),'-q:v','2',str(ui/name)],check=True)
    records.append({'route':route,'output':str((ui/name).relative_to(ROOT)),'sha256':hashlib.sha256((ui/name).read_bytes()).hexdigest(),'snapshot_exit_status':result.returncode})
(qa/'dashboard-capture-report.json').write_text(json.dumps({'method':'Hyperframes native snapshot of final source snapshot','captures':records},indent=2)+'\n')
print('Captured four final dashboard surfaces.')
