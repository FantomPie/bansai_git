"""Export the current public catalog; never include .local, credentials or native masters."""
import argparse,json,hashlib,zipfile
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('archive',type=Path);args=parser.parse_args()
source=args.source.resolve();rows=[];models=[];evidence=set()
def clean(x):
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if k not in {'sourcePath','qcReport','reference_provenance','ratio_evidence','provenance'}}
 if isinstance(x,list):return [clean(v) for v in x]
 if isinstance(x,str) and len(x)>2 and x[1]==':' and x[2] in '/\\':return None
 return x
def refs(x):
 if isinstance(x,dict):
  for v in x.values():refs(v)
 elif isinstance(x,list):
  for v in x:refs(v)
 elif isinstance(x,str) and x.startswith('/evidence/'):
  p=Path(x.split('?')[0]);assert p.name==x.split('?')[0].split('/')[-1];evidence.add(p.name)
for p in sorted((source/'models').glob('*.json')):
 m=json.loads(p.read_text(encoding='utf-8-sig'));glb=p.with_suffix('.glb')
 if m.get('hidden') or not glb.exists():continue
 m=clean(m);m.pop('delivery',None);models.append((p.stem,m,glb));refs(m)
 for suffix in ['', '_small']:evidence.add('poster_'+p.stem+suffix+'.jpg')
args.archive.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
 def put(name,data):
  z.writestr(name,data);rows.append({'path':name.removeprefix('data/'),'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 index=json.loads((source/'catalog-index.json').read_text(encoding='utf-8-sig'));put('data/catalog-index.json',json.dumps(clean(index),ensure_ascii=False).encode())
 for ident,m,p in models:
  put('data/models/'+ident+'.json',json.dumps(m,ensure_ascii=False).encode());name='data/models/'+ident+'.glb';h=hashlib.sha256()
  with p.open('rb') as src,z.open(name,'w',force_zip64=True) as dst:
   for chunk in iter(lambda:src.read(8*1024*1024),b''):h.update(chunk);dst.write(chunk)
  rows.append({'path':name.removeprefix('data/'),'size':p.stat().st_size,'sha256':h.hexdigest()});print('EXPORTED',ident,flush=True)
 for name in sorted(evidence):
  p=source/'public/evidence'/name
  if p.is_file():put('data/evidence/'+name,p.read_bytes())
  else:raise FileNotFoundError(p)
 manifest={'schema':1,'modelCount':len(models),'fileCount':len(rows),'files':rows};z.writestr('data/manifest.json',json.dumps(manifest,indent=2))
report={'archive':args.archive.name,'archiveBytes':args.archive.stat().st_size,'modelCount':len(models),'fileCount':len(rows),'uncompressedBytes':sum(r['size'] for r in rows)}
args.archive.with_suffix('.summary.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
