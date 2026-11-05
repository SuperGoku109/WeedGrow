from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw
import pdfplumber
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'tmp/pdfs/v7_qa';HERE.mkdir(exist_ok=True)
pdf=ROOT/'output/pdf/WeedGrow_Environmental_Response_Warnings_v7.0.pdf'
subprocess.run(['pdftoppm','-r','90','-png',str(pdf),str(HERE/'page')],check=True,capture_output=True)
imgs=sorted((p for p in HERE.glob('page-*.png') if p.stem.removeprefix('page-').isdigit()),key=lambda p:int(p.stem.split('-')[-1]))
for start in range(0,len(imgs),6):
 canvas=Image.new('RGB',(1020,2205),'#dce2df');draw=ImageDraw.Draw(canvas)
 for i,path in enumerate(imgs[start:start+6]):
  pic=Image.open(path).convert('RGB');pic.thumbnail((490,700))
  x=10+i%2*510;y=25+i//2*735;canvas.paste(pic,(x,y));draw.text((x,y-18),f'Page {start+i+1}',fill='black')
 canvas.save(HERE/f'contact-{start//6+1}.png')
vf=ROOT/'output/spec/WeedGrow_Environmental_Verification_v7.0.json';v=json.loads(vf.read_text())
issues=[];sizes=[]
with pdfplumber.open(pdf) as d:
 text='\n'.join(p.extract_text() or '' for p in d.pages)
 for i,p in enumerate(d.pages):
  t=p.extract_text() or '';sizes.append({'page':i+1,'chars':len(t)})
  outside=[c for c in p.chars if c.get('text','').strip() and (c['x0']<40 or c['x1']>p.width-40 or c['top']<10 or c['bottom']>p.height-12)]
  if outside:issues.append({'page':i+1,'outsideChars':len(outside)})
  if '\ufffd' in t or '\u25a0' in t:issues.append({'page':i+1,'badGlyph':True})
  if len(t)<450:issues.append({'page':i+1,'sparsePage':len(t)})
 for k in range(1,34):
  if f'[S{k:02}]' not in text:issues.append({'missingSource':k})
 for k in range(1,15):
  if f'W{k:02}' not in text:issues.append({'missingDetector':k})
 if 'Pinheiro' in text:issues.append({'wrongAuthor':True})
 if str(v['totalChecksPassed'])+' passing' not in text:issues.append({'checkCountMismatch':True})
r=PdfReader(pdf)
uris=set(str(a.get_object().get('/A',{}).get('/URI','')) for p in r.pages for a in p.get('/Annots',[]) if a.get_object().get('/A',{}).get('/URI'))
if len(imgs)!=len(r.pages):issues.append({'renderCountMismatch':True})
report={'pages':len(r.pages),'renderedPages':len(imgs),'issues':issues,'sourceURIs':len(uris),'bookmarks':len(r.outline),'visualReviewComplete':False,'pageTextSizes':sizes}
(HERE/'qa.json').write_text(json.dumps(report,indent=2));v['pdfQA']=report;vf.write_text(json.dumps(v,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='pageTextSizes'},indent=2))
