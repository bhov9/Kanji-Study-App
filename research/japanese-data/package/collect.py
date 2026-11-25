"""Download source archives for local review; no publication or curriculum changes."""
import hashlib, json, pathlib, urllib.request, datetime
ROOT=pathlib.Path(__file__).resolve().parent
RAW=ROOT/'raw'; RAW.mkdir(exist_ok=True)
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'KanjiStudyDataCollector/1.0'}),timeout=120)
def release(repo):
    with get(f'https://api.github.com/repos/{repo}/releases/latest') as r: return json.load(r)
items=[('shiberu','https://shiberu.app/data/frequency/ja-frequency-2026.tsv.gz','CC BY 4.0'),('shiberu-readme','https://shiberu.app/data/frequency/ja-frequency-2026-README.txt','retain source credits'),('tubelex','https://raw.githubusercontent.com/naist-nlp/tubelex/main/frequencies/tubelex-ja-lemma-pos.tsv.xz','verify aggregate data terms before redistribution')]
errors=[]
for repo,prefixes in [('scriptin/jmdict-simplified',['jmdict-examples-eng-','kanjidic2-all-','kradfile-']),('Doublevil/JmdictFurigana',['JmdictFurigana.json'])]:
    try:
        r=release(repo)
        for prefix in prefixes:
            candidates=[a for a in r['assets'] if a['name'].lower().startswith(prefix.lower()) and a['name'].endswith(('.tgz','.zip','.json.gz','.json'))]
            if not candidates: raise ValueError('No matching release asset: '+prefix)
            a=candidates[0]; items.append((prefix,a['browser_download_url'],'EDRDG / upstream terms; example and segmentation terms require review'))
    except Exception as e: errors.append({'source':repo,'error':str(e)})
manifest=[]
for name,url,license_note in items:
    try:
        from urllib.parse import urlsplit,unquote
        p=RAW/unquote(urlsplit(url).path.rsplit('/',1)[-1]); h=hashlib.sha256(); n=0
        with get(url) as r, p.with_suffix(p.suffix+'.part').open('wb') as f:
            for chunk in iter(lambda:r.read(1024*1024),b''):
                f.write(chunk); h.update(chunk); n+=len(chunk)
        p.with_suffix(p.suffix+'.part').replace(p)
        manifest.append(dict(source=name,url=url,file=p.name,sha256=h.hexdigest(),bytes=n,license_note=license_note,publication_approved=False))
    except Exception as e: errors.append({'source':name,'url':url,'error':str(e)})
(ROOT/'manifest.json').write_text(json.dumps({'collected_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':manifest,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(manifest)} downloads; {len(errors)} errors. Inspect manifest.json before proceeding.')
