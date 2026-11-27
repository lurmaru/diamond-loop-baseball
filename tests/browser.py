"""Run the full mobile UI loop in an isolated Chromium profile.

Requires Python, websockets and Edge (or set CHROMIUM to a Chromium binary).
With --url, smoke-test a deployed copy. Optional --shots stores two screenshots.
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
    b.shot(shots,'calendar')
    b.click('#settings')
    b.click('[data-act=sound]')
    b.click('[data-act=close]')
    b.click('[data-act=tab][data-n="1"]')
    b.click('[data-act=focus]:not(:disabled)')
    b.click('[data-act=tab][data-n="0"]')
    cards=b.js(state_expr)['cards']
    first_step=next(i for i,c in enumerate(cards) if c['steps']==1)
    b.click(f'[data-act=practice][data-n="{first_step}"]')
    state_expr = f'JSON.parse(localStorage.getItem("{KEY}"))'
    before=b.js(state_expr)
    b.send('Page.reload')
    b.wait('document.querySelector(".board")')
    assert before==b.js(state_expr), 'Reload changed game state'
    phases=set()
    for _ in range(140):
        s=b.js(state_expr)
        phase=s['phase']
        phases.add(phase)
        if s['report']:
            b.click('[data-act=ack]')
        elif s['year']>=2 and phase=='practice':
            break
        elif phase=='practice':
            i=next(i for i,c in enumerate(s['cards']) if c['steps']==1)
            b.click(f'[data-act=practice][data-n="{i}"]')
        elif phase in ['policy','skill']:
            b.click('[data-act=choose]')
        elif phase=='match':
            b.click('[data-act=exitMatch]' if s['match']['finished'] else '[data-act=play]')
        elif phase=='graduate':
            b.click('[data-act=graduate]')
        elif phase=='intake':
            b.click('[data-act=flip]' if s['drawn']<len(s['pack']) else '[data-act=enroll]')
        elif phase in ['shop','event','friendly','prize']:
            b.click('[data-act=visit]:not(:disabled)')
        assert b.js('document.documentElement.scrollWidth<=innerWidth')
    else:
        raise AssertionError('Season did not complete')
    assert {'practice','match','policy','skill','graduate','intake','shop','event','friendly'}<=phases
    assert len(s['roster'])==12
    b.click('[data-act=tab][data-n="2"]')
    b.click('[data-act=upgrade]:not(:disabled)')
    assert sum(b.js(state_expr)['facility'])==1
    b.click('[data-act=tab][data-n="3"]')
    assert b.js('document.querySelectorAll(".journal li").length')>=10
    # A returning player's real v1 fixture resumes where it left off and can try the
    # new opening without losing that school.
    legacy=json.loads((ROOT/'tests'/'legacy-save.json').read_text(encoding='utf8'))
    b.js('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(legacy))+')')
    b.send('Page.reload')
    b.wait('document.querySelector(".road")')
    migrated=b.js(state_expr)
    assert migrated['year']==legacy['year'] and migrated['phase']==legacy['phase']
    assert migrated['roster'][0]['stats']==legacy['roster'][0]['stats']
    b.click('#settings')
    b.click('[data-act=switchSchool]')
    assert b.js('document.querySelectorAll(".sealed").length')==9
    b.click('[data-act=flip]')
    b.send('Page.reload')
    b.wait('document.querySelector(".face-window")')
    b.click('#settings')
    b.click('[data-act=switchSchool]')
    assert b.js(state_expr)==migrated
    assert not b.errors, b.errors
    print('PASS nine-card intake, mobile & desktop, calendar stops, summer tournament, promotion, shop, facilities, legacy migration and two save slots',flush=True)


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
