"""Snapshot the final Gymbox dashboard into the isolated, editable film capture source."""
from pathlib import Path
import argparse,hashlib,json,shutil
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('repository',type=Path);args=parser.parse_args()
repo=args.repository.resolve();dest=ROOT/'dashboard-source';manifest=[]
for rel in ['src/gymbox-demo-admin/AdminDashboard.tsx','src/gymbox-demo-admin/data.ts','src/gymbox-demo-admin/admin-dashboard.css']:
 src=repo/rel;shutil.copy2(src,dest/src.name);manifest.append({'path':rel,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
for src in (repo/'gymbox-shared').glob('*.ts'):
 if src.name.endswith('.test.ts'):continue
 shutil.copy2(src,dest/'shared'/src.name);manifest.append({'path':str(src.relative_to(repo)),'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
for src in (repo/'src/gymbox-demo-admin').glob('gymbox-logo.*'):
 shutil.copy2(src,dest/src.name);manifest.append({'path':str(src.relative_to(repo)),'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
s=(dest/'AdminDashboard.tsx').read_text()
for expected in ['export function AdminDashboard() {', 'useState<View>("clubs")', 'useState<Sort>("volume")', 'useState<Detail | null>(null)']:
 if s.count(expected)!=1:raise SystemExit(f'Capture initializer needs review: {expected}')
s=s.replace('export function AdminDashboard() {','export function AdminDashboard({ capture = "overview" }: { capture?: "overview" | "trainers" | "emma" }) {')
s=s.replace('useState<View>("clubs")','useState<View>(capture === "overview" ? "clubs" : "trainers")').replace('useState<Sort>("volume")','useState<Sort>(capture === "overview" ? "volume" : "enquiries")').replace('useState<Detail | null>(null)','useState<Detail | null>(capture === "emma" ? {kind: "trainer", id: "gb-demo-emma-carter"} : null)')
s=s.replace('../../gymbox-shared/','./shared/')
(dest/'AdminDashboard.tsx').write_text(s)
p=dest/'shared/synthetic-catalogue.ts';p.write_text(p.read_text().replace('/gymbox-demo/trainers/', './trainers/'))
p=dest/'data.ts';p.write_text(p.read_text().replace('../../gymbox-shared/','./shared/'))
for src in (repo/'gymbox-demo/public/trainers').glob('gb-demo-*.webp'):
 shutil.copy2(src,ROOT/'composition/assets'/src.name)
(ROOT/'qa/dashboard-source-manifest.json').write_text(json.dumps({'snapshot_time':datetime.now(timezone.utc).isoformat(),'source_files':manifest,'capture_changes':['Initial view, sort and Emma dialog only','Presentation CSS matches approved capture geometry','Portrait asset paths rebased to identical local copies'],'captured_after_source_finalised':True},indent=2)+'\n')
print('Refreshed actual Gymbox component, data, shared catalogue and portraits')
