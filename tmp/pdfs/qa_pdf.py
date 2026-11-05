from pathlib import Path
import json
from PIL import Image, ImageOps, ImageDraw
import pdfplumber
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
imgs=sorted(HERE.glob('final-*.png'))
for start in range(0,len(imgs),6):
    canvas=Image.new('RGB',(1020,1512),'#dce2df')
    draw=ImageDraw.Draw(canvas)
    for i,path in enumerate(imgs[start:start+6]):
        pic=Image.open(path).convert('RGB'); pic.thumbnail((490,710))
        x=10+(i%2)*510; y=25+(i//2)*504
        # A4 page at 490px wide is ~693px high; six tiles need three 735px rows.
    canvas=Image.new('RGB',(1020,2205),'#dce2df'); draw=ImageDraw.Draw(canvas)
    for i,path in enumerate(imgs[start:start+6]):
        pic=Image.open(path).convert('RGB'); pic.thumbnail((490,700))
        x=10+(i%2)*510; y=25+(i//2)*735
        canvas.paste(pic,(x,y)); draw.text((x,y-18),f'Page {start+i+1}',fill='black')
    canvas.save(HERE/f'contact-{start//6+1}.png')

issues=[]; pages=[]
with pdfplumber.open(ROOT/'output/pdf/WeedGrow_Outdoor_Algorithm_FINAL_v4.0.pdf') as doc:
    for i,page in enumerate(doc.pages):
        chars=[x for x in page.chars if x.get('text','').strip()]
        body=[x for x in chars if x['top']>38 and x['bottom']<page.height-37]
        outside=[x for x in chars if x['x0']<40 or x['x1']>page.width-40 or x['top']<10 or x['bottom']>page.height-12]
        if outside: issues.append({'page':i+1,'outside':len(outside),'examples':[x['text'] for x in outside[:20]]})
        text=page.extract_text() or ''
        if '\ufffd' in text or '\u25a0' in text: issues.append({'page':i+1,'badGlyph':True})
        pages.append({'page':i+1,'chars':len(text),'bodyBottom':max([x['bottom'] for x in body],default=0)})
    alltext='\n'.join(p.extract_text() or '' for p in doc.pages)
    for k in range(1,65):
        if f'V40-{k:02}' not in alltext: issues.append({'missingCase':k})
    for k in range(1,22):
        if f'[R{k:02}]' not in alltext: issues.append({'missingReference':k})
HERE.joinpath('layout_qa.json').write_text(json.dumps({'issues':issues,'pages':pages},indent=2),encoding='utf-8')
print(json.dumps({'pages':len(pages),'issues':issues,'contactSheets':len(range(0,len(imgs),6))},indent=2))
