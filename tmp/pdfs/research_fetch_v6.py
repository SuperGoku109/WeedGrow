from pathlib import Path
import urllib.request, concurrent.futures
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]/'tmp/research_v6'
ROOT.mkdir(parents=True,exist_ok=True)
urls={
 'waterlogging_2026':'https://mdpi-res.com/d_attachment/crops/crops-06-00090/article_deploy/crops-06-00090.pdf',
 'botrytis_cannabis_2025':'https://www.tandfonline.com/doi/pdf/10.1080/07060661.2025.2478250',
 'pm_field_2026':'https://apsjournals.apsnet.org/doi/pdf/10.1094/PDIS-07-25-1591-RE',
 'kc_sa_2025':'https://jcannabisresearch.biomedcentral.com/counter/pdf/10.1186/s42238-025-00325-4.pdf',
}
def fetch(item):
 name,url=item
 try:
  request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(request,timeout=25) as response: data=response.read()
  if not data.startswith(b'%PDF'): return (name,'not_pdf',len(data))
  path=ROOT/(name+'.pdf');path.write_bytes(data)
  reader=PdfReader(path); body='\n'.join(page.extract_text() or '' for page in reader.pages)
  path.with_suffix('.txt').write_text(body,encoding='utf-8')
  return (name,'pdf',len(reader.pages),len(body))
 except Exception as e: return (name,type(e).__name__,str(e)[:140])
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(fetch,urls.items()): print(result)
