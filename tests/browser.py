"""Run the full mobile UI loop in an isolated Chromium profile.

Requires Python, websockets and Edge (or set CHROMIUM to a Chromium binary).
With --url, smoke-test a deployed copy. Optional --shots stores screenshots of each main screen.
"""
import argparse
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from urllib.request import urlopen

from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[1]
KEY = 'diamond-loop.school.v1'


class SilentHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def handle(self):
        try:
            super().handle()
        except ConnectionResetError:
            pass  # Chromium discards speculative connections when its profile closes.


class Browser:
    def __init__(self, ws):
        self.ws = ws
        self.serial = 0
        self.errors = []

    def send(self, method, **params):
        self.serial += 1
        self.ws.send(json.dumps(dict(id=self.serial, method=method, params=params)))
        while True:
            data = json.loads(self.ws.recv())
            if data.get('method') == 'Runtime.exceptionThrown':
                self.errors.append(data['params']['exceptionDetails'])
            if data.get('id') == self.serial:
                if 'error' in data:
                    raise RuntimeError(data['error'])
                return data['result']

    def js(self, expression):
        result = self.send('Runtime.evaluate', expression=expression, returnByValue=True)
        if 'exceptionDetails' in result:
            raise RuntimeError(result['exceptionDetails'])
        return result['result'].get('value')

    def wait(self, expression):
        for _ in range(250):
            if self.js('Boolean('+expression+')'):
                return
            time.sleep(0.04)
        raise AssertionError(expression)

    def click(self, selector):
        el = 'document.querySelector(' + json.dumps(selector) + ')'
        self.wait(el)
        point = self.js(f"""(()=>{{let b={el};b.scrollIntoView({{block:'center'}});
            let r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
            return {{x,y,ok:b.contains(document.elementFromPoint(x,y))&&!b.disabled}};}})()""")
        assert point.pop('ok'), f'Button unavailable: {selector}'
        for kind in ['mousePressed', 'mouseReleased']:
            self.send('Input.dispatchMouseEvent', type=kind, button='left', clickCount=1, **point)

    def screen(self, width, height):
        self.send('Emulation.setDeviceMetricsOverride', width=width, height=height,
                  deviceScaleFactor=1, mobile=width<760)

    def shot(self, folder, name):
        if folder:
            folder.mkdir(parents=True, exist_ok=True)
            data=self.send('Page.captureScreenshot', format='png')['data']
            (folder/(name+'.png')).write_bytes(base64.b64decode(data))


def exercise(b, url, shots):
    b.send('Runtime.enable')
    b.send('Page.enable')
    b.screen(1440, 900)
    b.send('Page.navigate', url=url)
    b.wait("document.querySelectorAll('.sealed').length===9 && document.querySelector('.card-back img').naturalWidth")
    assert b.js("getComputedStyle(document.querySelector('.recruit-cover')).backgroundImage.includes('spring-field.webp')")
    b.shot(shots,'desktop')
    for w in [320,390,768,1280,390]:
        b.screen(w,844)
        assert b.js('document.documentElement.scrollWidth<=innerWidth'), f'Overflow at {w}'
    b.shot(shots,'mobile')
    state_expr = f'JSON.parse(localStorage.getItem("{KEY}"))'
    b.click('[data-act=flip]')
    b.wait("document.querySelector('.face-window img').naturalWidth")
    b.shot(shots,'first-card')
    first=b.js(state_expr)
    b.send('Page.reload')
    b.wait("document.querySelector('.face-window')")
    assert first==b.js(state_expr)
    for n in range(2,10):
        b.click('[data-act=flip]')
        assert b.js(state_expr)['drawn']==n
    b.click('[data-act=enroll]')
    assert len(b.js(state_expr)['roster'])==9
    opening=b.js(state_expr)
    assert opening['phase']=='practice' and opening['deck']==list(range(12))
    assert not b.js("document.querySelector('[data-act=lock]')")
    assert len(opening['cards'])==4 and len(opening['tiles'])==365
    hand=b.js("Array.from(document.querySelectorAll('[data-act=practice]'),e=>[e.innerText,e.querySelector('img').src,e.querySelector('.card-rank').textContent])")
    assert all('の伸び' in v and '＋' not in v and '%' not in v and src and rank in ['N','R','SR'] for v,src,rank in hand)
    def layouts(name):
        for w in [320,390,768,1440]:
            b.screen(w,844)
            assert b.js('document.documentElement.scrollWidth<=innerWidth'), f'{name} overflow at {w}'
            if w in [390,1440]:
                b.shot(shots,f'{name}-{w}')
        b.screen(390,844)
    layouts('calendar')
    b.click('.year-plan summary')
    assert '365日' in b.js("document.querySelector('.year-plan').innerText") and b.js("document.querySelectorAll('.year-plan li').length")==9
    b.click('.year-plan summary')
    b.click('#settings')
    b.click('[data-act=sound]')
    b.click('[data-act=close]')
    b.click('[data-act=tab][data-n="1"]')
    b.click('.player-detail summary')
    b.js("(()=>{let el=document.querySelector('[data-individual]');el.value=el.value==='4'?'6':'4';el.dispatchEvent(new Event('change',{bubbles:true}));})()")
    assert b.js("Number(document.querySelector('[data-individual]').value)")==b.js(state_expr)['roster'][0]['individual']
    assert len(b.js(state_expr)['roster'][0]['stats'])==9
    layouts('team')
    b.click('[data-act=focus]:not(:disabled)')
    b.click('[data-act=tab][data-n="0"]')
    cards=b.js(state_expr)['cards']
    first_step=min(range(len(cards)),key=lambda i:cards[i]['steps'])
    b.click(f'[data-act=practice][data-n="{first_step}"]')
    state_expr = f'JSON.parse(localStorage.getItem("{KEY}"))'
    before=b.js(state_expr)
    b.send('Page.reload')
    b.wait('document.querySelector(".board")')
    assert before==b.js(state_expr), 'Reload changed game state'
    phases=set()
    builds=[]
    match_seen=False
    for _ in range(350):
        s=b.js(state_expr)
        phase=s['phase']
        phases.add(phase)
        if s['report']:
            b.click('[data-act=ack]')
        elif s['year']>=2 and phase=='practice':
            break
        elif phase=='practice':
            b.click('[data-act=auto]')
            assert 1<=b.js(state_expr)['day']-s['day']<=14
        elif phase=='build':
            builds.append((s['year'],s['buildWindow']))
            printed=b.js("document.querySelector('[data-act=toggle][data-n=\\\"0\\\"]').innerText")
            assert '素振り' in printed and '打撃 ＋2' in printed and '練習点' in b.js("document.querySelector('.board .hint').textContent")
            assert b.js("Array.from(document.querySelectorAll('.deck-card')).every(e=>e.querySelector('img') && e.querySelector('.card-rank'))")
            if s['year']==1:
                b.click('[data-act=toggle][data-n="13"]')
                b.click('[data-act=toggle][data-n="0"]')
                layouts('summer-build')
            b.click('[data-act=lock]')
        elif phase=='camp':
            b.shot(shots,'camp')
            b.click('[data-act=camp]')
        elif phase in ['evolve','mentor']:
            b.click('[data-act=teach]')
        elif phase in ['policy','skill']:
            b.click('[data-act=choose]')
        elif phase=='match':
            if not s['match']['finished']:
                labels=b.js("Array.from(document.querySelectorAll('[data-act=play] > b'), e=>e.textContent)")
                assert len(labels)==3 and all(v in ['有利','いけそう','慎重に','厳しい'] for v in labels)
                assert '%' not in b.js("document.querySelector('.options').textContent")
                if not match_seen:
                    layouts('match')
                    match_seen=True
            b.click('[data-act=exitMatch]' if s['match']['finished'] else '[data-act=play]')
        elif phase=='graduate':
            b.click('[data-act=graduate]')
        elif phase=='intake':
            b.click('[data-act=flip]' if s['drawn']<len(s['pack']) else '[data-act=enroll]')
        elif phase in ['shop','event','friendly','prize']:
            if phase=='friendly':
                assert '%' not in b.js("document.querySelector('.options').textContent")
            b.click('[data-act=visit]:not(:disabled)')
        assert b.js('document.documentElement.scrollWidth<=innerWidth')
    else:
        raise AssertionError('Season did not complete')
    assert {'build','practice','match','policy','camp','graduate','intake','event'}<=phases
    assert builds==[(1,'summer'),(2,'spring')]
    assert len(s['roster']) in [12,13]
    b.click('[data-act=tab][data-n="2"]')
    layouts('facilities')
    assert b.js("document.querySelectorAll('.upgrade').length")==6
    b.click('[data-act=upgrade]:not(:disabled)')
    assert sum(b.js(state_expr)['facility'])==1
    b.click('[data-act=tab][data-n="3"]')
    layouts('journal')
    assert b.js('document.querySelectorAll(".journal li").length')>=10
    # Exercise advanced screens with the same engine as a live campaign.
    def fixture(setup):
        b.js(f"(()=>{{const G=DiamondGame,s=G.initial(904);while(G.flip(s)){{}}G.enroll(s,s.pack[0].id);{setup};localStorage.setItem('{KEY}',JSON.stringify(s));}})()")
        b.send('Page.reload')
        b.wait('document.querySelector(".board")')
    fixture("s.phase='shop';s.cash=90;s.visit={};s.offers=[15,16,17]")
    layouts('shop')
    b.click('[data-act=expand]')
    b.click('[data-act=visit][data-n="0"]')
    b.click('[data-act=visit][data-n="3"]')
    assert len(b.js(state_expr)['cards'])==5
    assert b.js('document.querySelectorAll(".hand-card").length')==5
    fixture("const p=s.roster[0];p.grade=3;p.traits=[0,4,0];s.graduates=[p.id];s.phase='graduate';G.graduate(s,p.id);while(G.flip(s)){}G.enroll(s,s.pack[0].id);G.lockDeck(s);s.day=G.Y.events.alumni-1;G.practice(s,0);G.acknowledge(s)")
    b.click('[data-act=teach][data-n="13"]')
    assert next(c for c in b.js(state_expr)['library'] if c['id']==13)['mentor']
    fixture("s.day=G.Y.events.autumn;s.phase='match';s.match={round:0,competition:'autumn',level:52,opp:'試験校',us:3,them:1,step:3,scene:0,plays:[],finished:true}")
    b.click('[data-act=exitMatch]')
    assert b.js(state_expr)['tiles'][334]=='spring'
    # A returning player's real v1 fixture resumes where it left off and can try the
    # new opening without losing that school.
    previous=json.loads((ROOT/'tests'/'v4-autumn-save.json').read_text(encoding='utf8'))
    b.js('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(previous))+')')
    b.send('Page.reload')
    b.wait("document.querySelector('[data-act=play]')")
    upgraded=b.js(state_expr)
    assert upgraded['day']==183 and upgraded['match']==previous['match'] and upgraded['version']==5
    assert len(upgraded['roster'][0]['stats'])==9
    legacy=json.loads((ROOT/'tests'/'legacy-save.json').read_text(encoding='utf8'))
    b.js('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(legacy))+')')
    b.send('Page.reload')
    b.wait('document.querySelector(".road")')
    migrated=b.js(state_expr)
    assert migrated['year']==legacy['year'] and migrated['phase']==legacy['phase']
    assert migrated['roster'][0]['stats'][:3]==legacy['roster'][0]['stats']
    b.click('#settings')
    b.click('[data-act=switchSchool]')
    assert b.js('document.querySelectorAll(".sealed").length')==9
    b.click('[data-act=flip]')
    b.send('Page.reload')
    b.wait('document.querySelector(".face-window")')
    b.click('#settings')
    b.click('[data-act=switchSchool]')
    assert b.js(state_expr)==migrated
    # Cancel deletion, delete the inactive slot, then erase the active slot.
    b.click('#settings')
    b.click('[data-act=askDelete][data-n="2"]')
    b.click('[data-act=cancelDelete]')
    assert b.js("JSON.parse(localStorage.getItem('diamond-loop.school.second')).drawn")==1
    b.click('[data-act=askDelete][data-n="2"]')
    b.click('[data-act=deleteSlot]')
    assert b.js("localStorage.getItem('diamond-loop.school.second')")==None
    assert b.js(state_expr)==migrated
    b.click('#settings')
    b.click('[data-act=askDelete][data-n="1"]')
    b.click('[data-act=deleteSlot]')
    b.send('Page.reload')
    b.wait("document.querySelectorAll('.sealed').length===9")
    assert b.js(state_expr)==None
    b.click('[data-act=flip]')
    assert b.js(state_expr)['drawn']==1
    b.click('#settings')
    b.click('[data-act=switchSchool]')
    b.click('[data-act=flip]')
    b.click('#settings')
    b.click('[data-act=askDelete][data-n="2"]')
    b.click('[data-act=deleteSlot]')
    assert b.js("localStorage.getItem('diamond-loop.active')")=='1'
    assert b.js(state_expr)['drawn']==1 and b.js("localStorage.getItem('diamond-loop.school.second')")==None
    assert not b.errors, b.errors
    print('PASS widths 320/390/768/1440, fixed opening deck, summer/spring edits, 365-day season, illustrated rarity cards, qualitative growth, individual training, six facilities, deletion, camps, recruiting, shop, returning alumnus, promotion, migration and two save slots',flush=True)


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--url')
    args.add_argument('--shots',type=Path)
    options=args.parse_args()
    server=None
    if not options.url:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(SilentHandler,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
    browser=os.environ.get('CHROMIUM',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        proc=subprocess.Popen([browser,'--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
            '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        try:
            portfile=Path(profile)/'DevToolsActivePort'
            for _ in range(200):
                if portfile.is_file() and portfile.stat().st_size:break
                time.sleep(.05)
            port=int(portfile.read_text().splitlines()[0])
            targets=json.load(urlopen(f'http://127.0.0.1:{port}/json/list',timeout=5))
            page=next(t for t in targets if t['type']=='page')
            ws=connect(page['webSocketDebuggerUrl'],open_timeout=10,max_size=8*1024*1024)
            try:
                exercise(Browser(ws),options.url or f'http://127.0.0.1:{server.server_port}/',options.shots)
            finally:
                ws.close()
        finally:
            proc.terminate()
            proc.wait(timeout=15)
            if server:server.shutdown()


if __name__=='__main__':
    main()
