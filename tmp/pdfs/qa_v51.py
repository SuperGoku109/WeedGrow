from pathlib import Path
import json
from PIL import Image, ImageDraw
import pdfplumber
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).resolve().parent
imgs=sorted(p for p in HERE.glob('v51-reviewed-*.png') if p.stem.removeprefix('v51-reviewed-').isdigit())
for start in range(0,len(imgs),6):
    canvas=Image.new('RGB',(1020,2205),'#dce2df'); draw=ImageDraw.Draw(canvas)
    for i,path in enumerate(imgs[start:start+6]):
        pic=Image.open(path).convert('RGB'); pic.thumbnail((490,700))
        x=10+(i%2)*510; y=25+(i//2)*735
        canvas.paste(pic,(x,y)); draw.text((x,y-18),f'Page {start+i+1}',fill='black')
    canvas.save(HERE/f'v51-reviewed-contact-{start//6+1}.png')
issues=[]
with pdfplumber.open(ROOT/'output/pdf/WeedGrow_Outdoor_Algorithm_FINAL_v5.1.pdf') as doc:
    alltext='\n'.join(p.extract_text() or '' for p in doc.pages)
    for i,page in enumerate(doc.pages):
        outside=[x for x in page.chars if x.get('text','').strip() and (x['x0']<40 or x['x1']>page.width-40 or x['top']<10 or x['bottom']>page.height-12)]
        if outside: issues.append({'page':i+1,'outside':len(outside)})
        t=page.extract_text() or ''
        if '\ufffd' in t or '\u25a0' in t: issues.append({'page':i+1,'badGlyph':True})
        if len(t)<450: issues.append({'page':i+1,'sparsePage':len(t)})
    for k in range(1,49):
        if f'V50-{k:02}' not in alltext: issues.append({'missingCase':k})
    for k in range(1,43):
        if f'WARN-{k:02}' not in alltext: issues.append({'missingWarningCase':k})
    for k in range(1,25):
        if f'[R{k:02}]' not in alltext: issues.append({'missingSource':k})
pdf=PdfReader(ROOT/'output/pdf/WeedGrow_Outdoor_Algorithm_FINAL_v5.1.pdf')
if len(imgs)!=len(pdf.pages): issues.append({'renderedPageCountMismatch':len(imgs)})
uris=set(str(a.get_object().get('/A',{}).get('/URI','')) for p in pdf.pages for a in p.get('/Annots',[]) if a.get_object().get('/A',{}).get('/URI'))
report={'pages':len(pdf.pages),'issues':issues,'sources':len(uris),'bookmarks':len(pdf.outline),'renderedPages':len(imgs)}
HERE.joinpath('v51-layout-qa.json').write_text(json.dumps(report,indent=2))
verification=ROOT/'output/spec/WeedGrow_Outdoor_Algorithm_v5.1_Verification.json'
v=json.loads(verification.read_text()); v['pdfQA']=report; verification.write_text(json.dumps(v,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))


