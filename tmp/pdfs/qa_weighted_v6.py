from pathlib import Path
import subprocess, json
from PIL import Image, ImageDraw
import pdfplumber
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'tmp/pdfs/v6_qa';HERE.mkdir(exist_ok=True)
pdf=ROOT/'output/pdf/WeedGrow_Weighted_Warning_Model_v6.0.pdf'
subprocess.run(['pdftoppm','-r','90','-png',str(pdf),str(HERE/'page')],check=True,capture_output=True)
imgs=sorted((p for p in HERE.glob('page-*.png') if p.stem.removeprefix('page-').isdigit()),key=lambda p:int(p.stem.split('-')[-1]))
for start in range(0,len(imgs),6):
 canvas=Image.new('RGB',(1020,2205),'#dce2df');draw=ImageDraw.Draw(canvas)
 for i,path in enumerate(imgs[start:start+6]):
  pic=Image.open(path).convert('RGB');pic.thumbnail((490,700))
  x=10+(i%2)*510;y=25+(i//2)*735
  canvas.paste(pic,(x,y));draw.text((x,y-18),f'Page {start+i+1}',fill='black')
 canvas.save(HERE/f'contact-{start//6+1}.png')
issues=[];sizes=[]
with pdfplumber.open(pdf) as doc:
 text='\n'.join(p.extract_text() or '' for p in doc.pages)
 for i,page in enumerate(doc.pages):
  t=page.extract_text() or '';sizes.append({'page':i+1,'chars':len(t)})
  outside=[x for x in page.chars if x.get('text','').strip() and (x['x0']<40 or x['x1']>page.width-40 or x['top']<10 or x['bottom']>page.height-12)]
  if outside:issues.append({'page':i+1,'outside':len(outside)})
  if '\ufffd' in t or '\u25a0' in t:issues.append({'page':i+1,'badGlyph':True})
  if len(t)<450:issues.append({'page':i+1,'sparsePage':len(t)})
 for k in range(1,16):
  if f'[S{k:02}]' not in text:issues.append({'missingSource':k})
 for k in range(1,15):
  if f'W{k:02}' not in text:issues.append({'missingDetector':k})
 v0=json.loads((ROOT/'output/spec/WeedGrow_Weighted_Warnings_v6.0_Verification.json').read_text())
 count=v0['referenceChecksPassed']
 if f'{count}/{count}' not in text:issues.append({'wrongCheckCount':True})
reader=PdfReader(pdf)
uris=set(str(a.get_object().get('/A',{}).get('/URI','')) for p in reader.pages for a in p.get('/Annots',[]) if a.get_object().get('/A',{}).get('/URI'))
if len(imgs)!=len(reader.pages):issues.append({'renderMismatch':len(imgs)})
report={'pages':len(reader.pages),'issues':issues,'sourceURIs':len(uris),'bookmarks':len(reader.outline),'renderedPages':len(imgs),'pageTextSizes':sizes,'visualReviewComplete':False}
(HERE/'qa.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
vf=ROOT/'output/spec/WeedGrow_Weighted_Warnings_v6.0_Verification.json'
v=json.loads(vf.read_text());v['pdfQA']=report;vf.write_text(json.dumps(v,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='pageTextSizes'},indent=2))
