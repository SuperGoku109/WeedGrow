from pathlib import Path
import urllib.request, concurrent.futures, json
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]/'tmp/research_v7';ROOT.mkdir(exist_ok=True)
urls={
 'chandra_2008':'https://link.springer.com/content/pdf/10.1007/s12298-008-0027-x.pdf',
 'chandra_2011':'https://link.springer.com/content/pdf/10.1007/s12298-011-0068-4.pdf',
 'tang_2017':'https://publicatt.unicatt.it/retrieve/e309db6c-a548-0599-e053-3705fe0a55db/2017%20Tang%20GCB_Bioenergy.pdf',
 'sheldon_2021':'https://hemp.ucdavis.edu/sites/g/files/dgvnsk12601/files/media/documents/Physiological%20screening%20for%20drought%20tolerance%20traits%20among%20hemp%20Cannabis%20sativa%20L%20cultivars%20in%20controlled%20environments%20and%20in%20field%20-%20Sheldon%20et%20al..pdf',
 'field_physiology_2025':'https://journal.wildlife.ca.gov/2025/12/29/hemp-physiological-response-to-seasonal-variation-in-photosynthetic-capacity-for-two-high-yield-cannabidiol-cbd-cultivars/?print=pdf',
 'cold_2025':'https://jcannabisresearch.biomedcentral.com/counter/pdf/10.1186/s42238-025-00311-w.pdf',
 'salt_drought_2024':'https://mdpi-res.com/d_attachment/jof/jof-10-00283/article_deploy/jof-10-00283.pdf',
 'genotype_drought_2025':'https://mdpi-res.com/d_attachment/plants/plants-14-03840/article_deploy/plants-14-03840.pdf',
 'tang_canopy_2018':'https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2018.00951/pdf',
 'mateva_2024':'https://www.frontiersin.org/journals/plant-physiology/articles/10.3389/fphgy.2024.1441262/pdf',
 'humidity_2025':'https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2025.1678142/pdf',
 'light_2021':'https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2021.646020/pdf',
}
def fetch(item):
 name,url=item
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=35) as response:data=response.read()
  if not data.startswith(b'%PDF'):return {'id':name,'url':url,'status':'not_pdf'}
  path=ROOT/(name+'.pdf');path.write_bytes(data);r=PdfReader(path)
  body='\n'.join(f'\n[PAGE {i+1}]\n'+(p.extract_text() or '') for i,p in enumerate(r.pages))
  path.with_suffix('.txt').write_text(body,encoding='utf-8')
  return {'id':name,'url':url,'status':'pdf','pages':len(r.pages),'chars':len(body)}
 except Exception as e:return {'id':name,'url':url,'status':'unavailable','reason':str(e)[:120]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:results=list(p.map(fetch,urls.items()))
(ROOT/'fetch_manifest.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
for r in results:print(json.dumps(r))
