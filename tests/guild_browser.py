"""Exercise the public RPG entry point, including three contracts and resuming combat."""
import json
from urllib.parse import urljoin
from browser import main

KEY='starfall.guild.v1.1'
STATE=f'JSON.parse(localStorage.getItem("{KEY}"))'


def exercise(b,url,shots):
    b.send('Page.enable')
    b.send('Runtime.enable')
    b.screen(390,844)
    b.send('Page.navigate',url=url)
    b.wait("window.StarGuild && document.querySelector('.drawstage')")
    assert '星灯りの旅団' in b.js('document.title')
    b.js(f"localStorage.setItem('{KEY}',JSON.stringify(StarGuild.initial(1942)))")
    b.js("localStorage.setItem('diamond-loop.school.v1','older-player-record')")
    b.send('Page.reload')
    b.wait("document.querySelector('.drawstage')")
    def layouts(name):
        for width in [320,390,768,1440]:
            b.screen(width,844)
            assert b.js('document.documentElement.scrollWidth<=innerWidth'), name+str(width)
            b.wait("Array.from(document.querySelectorAll('main img')).every(i=>i.complete && i.naturalWidth>0)")
            if width in [390,1440]:
                b.shot(shots,f'guild-{name}-{width}')
        b.screen(390,844)
    def act(action,n=None):
        sel=f'[data-act="{action}"]'
        if n is not None:sel+=f'[data-n="{n}"]'
        b.click(sel+':not(:disabled)')
    def reload_same(selector):
        old=b.js(STATE)
        b.send('Page.reload')
        b.wait('document.querySelector('+json.dumps(selector)+')')
        assert old==b.js(STATE)
    layouts('opening')
    act('reveal',0)
    reload_same('.face')
    act('reveal',1)
    layouts('draw')
    act('accept')
    layouts('hand')
    act('tab',1)
    layouts('members')
    act('tab',2)
    layouts('hall')
    act('tab',0)
    seen=set()
    for _ in range(1250):
        s=b.js(STATE)
        phase=s['phase']
        if s['notice']:
            act('ack')
            continue
        if s['year']==4 and phase=='intake':break
        if phase not in seen and phase in ['prepare','battle','result','build','camp','succession']:
            layouts(phase)
        seen.add(phase)
        if phase=='practice':act('auto')
        elif phase=='intake':act('accept' if s['drawn']==3 else 'reveal',None if s['drawn']==3 else 1)
        elif phase=='build':act('lock')
        elif phase=='prepare':
            act('tab',1)
            if len(s['roster'])>3:
                reserve=next(p for p in s['roster'] if p['id'] not in s['party'])
                b.js(f"(()=>{{const el=document.querySelector('[data-party=\"{reserve['id']}\"]');el.value='0';el.dispatchEvent(new Event('change',{{bubbles:true}}));}})()")
                assert b.js(STATE)['party'][0]==reserve['id']
            act('tab',0)
            act('launch')
        elif phase=='battle':
            e=s['expedition']
            k=2 if e['intent']==0 else 1 if e['intent']==1 and e['mp']>=2 else 0
            act('strike',k)
            if 'resumed-battle' not in seen and b.js(STATE)['phase']=='battle':
                reload_same('.fight');seen.add('resumed-battle')
        elif phase=='result':
            if 'resumed-result' not in seen:
                reload_same('.outcome');seen.add('resumed-result')
            e=s['expedition']
            pick=0 if e['finished'] else e['rewards'].index(1)
            act('advance',pick)
        elif phase=='camp':act('camp')
        elif phase=='oath':act('oath',s['blessings'].index('journey'))
        elif phase=='succession':act('succession')
        elif phase=='evolve':act('teach')
        elif phase=='mentor':act('teach' if b.js("!!document.querySelector('[data-act=teach]')") else 'skipMentor')
        elif phase=='event':act('visit',1)
        elif phase=='friendly':act('visit',s['weak'])
        elif phase=='loot':act('visit')
        elif phase=='shop':
            if b.js("!!document.querySelector('[data-act=visit][data-n=\"4\"]:not(:disabled)')"):act('visit',4)
            act('visit',3)
        else:raise AssertionError(phase)
    else:raise AssertionError('Failed to reach fourth recruitment')
    assert {'prepare','battle','result','resumed-battle','resumed-result','camp','oath','build','succession'}<=seen
    assert s['heir'] and len(s['veterans'])==3 and len(s['roster'])==6
    assert b.js("localStorage.getItem('diamond-loop.school.v1')")=='older-player-record'
    act('tab',2)
    act('upgrade')
    assert sum(b.js(STATE)['facility'])==1
    b.click('#settings')
    act('sound')
    assert b.js("localStorage.getItem('starfall.guild.v1.sound')")=='on'
    act('slot',2)
    assert b.js("JSON.parse(localStorage.getItem('starfall.guild.v1.2')).year")==1
    b.click('#settings')
    act('slot',1)
    assert b.js(STATE)['year']==4
    assert not b.errors,b.errors
    # Legacy front-end remains directly accessible at the same origin.
    b.send('Page.navigate',url=urljoin(url,'baseball.html'))
    b.wait("document.title.includes('ダイヤモンドループ') && window.DiamondGame")
    print('PASS RPG: 3 years of real clicks, inheritance, combat, reward/reload, illustrated mobile and desktop views, party, facilities, separate slots and legacy entry.',flush=True)


if __name__=='__main__':
    main(exercise,'/')
