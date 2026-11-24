"""魔方陣 採点の前提: 誤った置きの見え方、試し置きの取り下げ、組の候補の量を測る（標準ライブラリのみ、seed 固定）。"""
import random, statistics as stt
from itertools import combinations

def lines_of(n):
    L=[[(r,c) for c in range(n)] for r in range(n)]+[[(r,c) for r in range(n)] for c in range(n)]
    return L+[[(i,i) for i in range(n)],[(i,n-1-i) for i in range(n)]]
class C:
    def __init__(s,n):
        s.n=n; s.N=n*n; s.M=n*(n*n+1)//2; s.L=lines_of(n)
        s.cells=[(r,c) for r in range(n) for c in range(n)]
        s.cl={p:[i for i,l in enumerate(s.L) if p in l] for p in s.cells}

def random_square(cx,rng):
    """候補の最も少ないマスから乱順に埋め、列の合計の上下限で刈り込む。"""
    n,M,L,cells,cl,N=cx.n,cx.M,cx.L,cx.cells,cx.cl,cx.N
    g={};used=set();sums=[0]*len(L);empt=[n]*len(L);steps=[0]
    def okv(p,v):
        for i in cl[p]:
            s=sums[i]+v
            if s>M or (empt[i]==1 and s!=M): return False
        return True
    def feas():
        rem=sorted(set(range(1,N+1))-used)
        for i in range(len(L)):
            k=empt[i];need=M-sums[i]
            if k==0:
                if need: return False
            elif sum(rem[:k])>need or sum(rem[-k:])<need: return False
        return True
    def rec():
        steps[0]+=1
        if steps[0]>20000: return False
        best=None;bc=None
        for p in cells:
            if p in g: continue
            cs=[v for v in range(1,N+1) if v not in used and okv(p,v)]
            if best is None or len(cs)<len(bc) or (len(cs)==len(bc) and rng.random()<0.5): best,bc=p,cs
            if not cs: return False
        if best is None: return True
        rng.shuffle(bc)
        for v in bc:
            g[best]=v;used.add(v)
            for i in cl[best]: sums[i]+=v;empt[i]-=1
            if feas() and rec(): return True
            for i in cl[best]: sums[i]-=v;empt[i]+=1
            used.discard(v);del g[best]
        return False
    while True:
        g.clear();used.clear();sums[:]=[0]*len(L);empt[:]=[n]*len(L);steps[0]=0
        if rec(): return dict(g)

def st_(cx,g,l): return sum(g[p] for p in l if p in g),[p for p in l if p not in g]
def remset(cx,g): return set(range(1,cx.N+1))-set(g.values())

def line_support(cl_,need):
    """1つの列の空きマスの候補から、足して need になる組（どの数も1回）に現れる値をマスごとに返す。"""
    k=len(cl_);sup=[set() for _ in range(k)];cs=[set(c) for c in cl_]
    order=sorted(range(k),key=lambda j:len(cl_[j]));mins=[min(c) for c in cl_];maxs=[max(c) for c in cl_]
    ch=[0]*k;usedv=set()
    def rec(ix,left):
        j=order[ix]
        if ix==k-1:
            if left in cs[j] and left not in usedv:
                ch[j]=left
                for t in range(k): sup[t].add(ch[t])
            return
        rest=order[ix+1:];lo=sum(mins[t] for t in rest);hi=sum(maxs[t] for t in rest)
        for v in cl_[j]:
            if v in usedv: continue
            r=left-v
            if r<lo: break
            if r>hi: continue
            ch[j]=v;usedv.add(v);rec(ix+1,r);usedv.discard(v)
    rec(0,need);return sup

def arc(cx,g):
    rem=remset(cx,g);cand={p:set(rem) for p in cx.cells if p not in g};ch=True
    while ch:
        ch=False
        for l in cx.L:
            s,e=st_(cx,g,l)
            if not e: continue
            sup=line_support([sorted(cand[p]) for p in e],cx.M-s)
            for p,su in zip(e,sup):
                if su!=cand[p]:
                    cand[p]&=su;ch=True
                    if not cand[p]: return None
    return cand

def logic_solve(cx,g0,level):
    """level 1: 1マスだけ空いた列（T1）だけ。level 2: T1 と、列ごとの組の候補を交わる列と突き合わせる（T2）。"""
    g=dict(g0);tr=[];states=[dict(g)]
    while len(g)<cx.N:
        rem=remset(cx,g);mv=False
        for l in cx.L:
            s,e=st_(cx,g,l)
            if len(e)==1:
                v=cx.M-s
                if v not in rem: return False,tr,states
                g[e[0]]=v;tr.append('T1');mv=True;break
        if not mv:
            if level<2: return False,tr,states
            cand=arc(cx,g)
            if cand is None: return False,tr,states
            sg=[(p,next(iter(c))) for p,c in cand.items() if len(c)==1]
            if sg: g[sg[0][0]]=sg[0][1];tr.append('T2');mv=True
            else:
                for v in sorted(rem):
                    ps=[p for p,c in cand.items() if v in c]
                    if len(ps)==1: g[ps[0]]=v;tr.append('T2');mv=True;break
            if not mv: return False,tr,states
        states.append(dict(g))
    return True,tr,states

def make(cx,rng,level):
    sq=random_square(cx,rng);g=dict(sq);order=cx.cells[:];rng.shuffle(order)
    for p in order:
        v=g.pop(p)
        if not logic_solve(cx,g,level)[0]: g[p]=v
    return sq,g

def classify(cx,g,p,v):
    """誤った数 v をマス p に置いた直後に、盤面から何が分かるか。"""
    M=cx.M;rem2=remset(cx,g)-{v};g2=dict(g);g2[p]=v;full=over=glance=False
    for l in cx.L:
        s,e=st_(cx,g2,l)
        if not e and s!=M: full=full or (p in l)
        if s>M: over=True
        if len(e)==1 and (M-s) not in rem2: glance=True
    return 'full' if full else 'over' if over else 'glance' if glance else 'silent',g2

def chain_detect(cx,g):
    """1マスだけ空いた列をあとの数で埋め続けたとき、何マス目で矛盾が見えるか（見えなければ None）。"""
    g=dict(g);k=0;M=cx.M
    while True:
        rem=remset(cx,g);f=None
        for l in cx.L:
            s,e=st_(cx,g,l)
            if s>M or (not e and s!=M) or (len(e)==1 and (M-s) not in rem): return k
            if len(e)==1 and f is None: f=(e[0],M-s)
        if f is None: return None
        g[f[0]]=f[1];k+=1

class Cap(Exception): pass

def trial(cx,givens,rng,mode,cap=30000):
    """mode O1: あといくつと違反（超えた・埋まって合わない）が見え、1マスだけ空いた列はあとの数を置き、止まったら1マスに数を試す。
       mode O3: 埋まった列の合否だけが見え、計算しない（1マスだけ空いた列も、合うまで数を試す）。"""
    g=dict(givens);S={'place':0,'remove':0,'guess':0};M=cx.M;N=cx.N
    def contra():
        rem=remset(cx,g)
        for l in cx.L:
            s,e=st_(cx,g,l)
            if not e and s!=M: return True
            if mode=='O1' and (s>M or (len(e)==1 and (M-s) not in rem)): return True
        return False
    def fullbad(p):
        for i in cx.cl[p]:
            s,e=st_(cx,g,cx.L[i])
            if not e and s!=M: return True
        return False
    def forced():
        for l in cx.L:
            s,e=st_(cx,g,l)
            if len(e)==1:
                p=e[0]
                if mode=='O1':
                    g[p]=M-s;S['place']+=1;return p
                vals=sorted(remset(cx,g));rng.shuffle(vals)
                for v in vals:
                    g[p]=v;S['place']+=1
                    if not fullbad(p): return p
                    del g[p];S['remove']+=1
                return 'contra'
        return None
    def choose():
        rem=sorted(remset(cx,g));empties=[p for p in cx.cells if p not in g]
        if mode=='O1':
            best=None
            for p in empties:
                b=min(M-st_(cx,g,cx.L[i])[0] for i in cx.cl[p])
                cs=[v for v in rem if v<=b]
                if best is None or len(cs)<len(best[1]) or (len(cs)==len(best[1]) and rng.random()<0.5): best=(p,cs)
            p,cs=best
        else:
            ln=[l for l in cx.L if len(st_(cx,g,l)[1])>=2];m=min(len(st_(cx,g,l)[1]) for l in ln)
            l=rng.choice([l for l in ln if len(st_(cx,g,l)[1])==m]);p=rng.choice(st_(cx,g,l)[1]);cs=rem[:]
        cs=cs[:];rng.shuffle(cs);return p,cs
    def undo(placed):
        for p in placed: del g[p];S['remove']+=1
    def rec():
        placed=[]
        while True:
            if S['place']>cap: raise Cap
            if contra(): undo(placed);return False
            r=forced()
            if r=='contra': undo(placed);return False
            if r is None: break
            placed.append(r)
        if len(g)==N: return True
        p,cs=choose()
        for v in cs:
            g[p]=v;S['place']+=1;S['guess']+=1
            if rec(): return True
            del g[p];S['remove']+=1
        undo(placed);return False
    try: ok=rec()
    except Cap: return None
    assert ok and all(sum(g[p] for p in l)==M for l in cx.L)
    return S

def trial_combo(cx,givens,sq,rng,cap=30000):
    """あといくつが見える前提で、2マス空いた列の組（順序つき）を試し置きし、1マスだけ空いた列をあとの数で追う。"""
    g=dict(givens);S={'place':0,'remove':0,'tries':0};M=cx.M;N=cx.N
    def bound(p): return min(M-st_(cx,g,cx.L[i])[0] for i in cx.cl[p])
    def contra():
        rem=remset(cx,g)
        for l in cx.L:
            s,e=st_(cx,g,l)
            if (not e and s!=M) or s>M or (len(e)==1 and (M-s) not in rem): return True
        return False
    def forced():
        for l in cx.L:
            s,e=st_(cx,g,l)
            if len(e)==1: g[e[0]]=M-s;S['place']+=1;return e[0]
        return None
    def undo(ps):
        for p in ps: del g[p];S['remove']+=1
    def rec():
        placed=[]
        while True:
            if S['place']>cap: raise Cap
            if contra(): undo(placed);return False
            r=forced()
            if r is None: break
            placed.append(r)
        if len(g)==N: return True
        rem=remset(cx,g);best=None
        for l in cx.L:
            s,e=st_(cx,g,l)
            if len(e)!=2: continue
            a,b=e;b1,b2=bound(a),bound(b)
            pr=[(x,M-s-x) for x in rem if (M-s-x) in rem and x!=M-s-x and x<=b1 and M-s-x<=b2]
            if best is None or len(pr)<len(best[1]) or (len(pr)==len(best[1]) and rng.random()<0.5): best=((a,b),pr)
        if best is None:
            p=min((q for q in cx.cells if q not in g),key=lambda q:(sum(1 for v in rem if v<=bound(q)),rng.random()))
            opts=[((p,),(v,)) for v in rem if v<=bound(p)]
        else:
            opts=[(best[0],pr) for pr in best[1]]
        rng.shuffle(opts)
        for ps,vs in opts:
            for p,v in zip(ps,vs): g[p]=v;S['place']+=1
            S['tries']+=1
            if rec(): return True
            for p in ps: del g[p];S['remove']+=1
        undo(placed);return False
    try: ok=rec()
    except Cap: return None
    assert ok and all(g[p]==sq[p] for p in cx.cells)
    return S

def combos(cx,g):
    """始めの盤面で、2〜3マス空いた列ごとに、残りの数から足してあとになる組（順序なし）の数。"""
    rem=sorted(remset(cx,g));out=[]
    for l in cx.L:
        s,e=st_(cx,g,l)
        if len(e) in (2,3): out.append((len(e),sum(1 for c in combinations(rem,len(e)) if sum(c)==cx.M-s)))
    return out

def q(xs):
    xs=sorted(xs)
    return f"{xs[0]}/{stt.median(xs)}/{xs[-1]}" if xs else '-'
def pct(d):
    t=sum(d.values());return t,{k:f"{100*v/t:.0f}%" for k,v in d.items()}

for n,level,cnt in [(4,1,30),(4,2,30),(5,1,10),(5,2,10)]:
    cx=C(n);vis_all=dict.fromkeys(['full','over','glance','silent'],0);vis0=dict(vis_all)
    chain_k=[];chain_none=0;sil_n=0;info=[];o1=[];o3=[];o3cap=0;cb=[];cbcap=0;cmb2=[];cmb3=[]
    for s in range(cnt):
        rng=random.Random(10000*n+1000*level+s)
        sq,g=make(cx,rng,level)
        ok,tr,states=logic_solve(cx,g,2)
        assert ok and all(states[-1][p]==sq[p] for p in cx.cells)
        assert level==1 or not logic_solve(cx,g,1)[0]
        info.append((cx.N-len(g),tr.count('T1'),tr.count('T2'),any(len(st_(cx,g,l)[1])==1 for l in cx.L)))
        for si,S0 in enumerate(states[:-1]):
            for p in cx.cells:
                if p in S0: continue
                for v in remset(cx,S0):
                    if v==sq[p]: continue
                    c,g2=classify(cx,S0,p,v);vis_all[c]+=1
                    if si==0: vis0[c]+=1
                    if c=='silent':
                        sil_n+=1;k=chain_detect(cx,g2)
                        if k is None: chain_none+=1
                        else: chain_k.append(k)
        for t in range(5):
            o1.append(trial(cx,g,random.Random(s*100+t),'O1'))
            r=trial(cx,g,random.Random(s*100+t),'O3')
            if r is None: o3cap+=1
            else: o3.append(r)
            if level==2:
                r=trial_combo(cx,g,sq,random.Random(s*100+t))
                if r is None: cbcap+=1
                else: cb.append(r)
        for k,c in combos(cx,g): (cmb2 if k==2 else cmb3).append(c)
    print(f"== {n}x{n} level{level} ({cnt}問)")
    print("  空き/T1/T2:",q([i[0] for i in info]),q([i[1] for i in info]),q([i[2] for i in info]),"始めにT1がある問題",sum(i[3] for i in info))
    print("  誤った置き 始めの盤面",*pct(vis0)," 全局面",*pct(vis_all))
    print("  何も出ない誤りを追うと見える",f"{100*len(chain_k)/max(1,sil_n):.0f}%","追ったマス",q(chain_k),"見えない",f"{100*chain_none/max(1,sil_n):.0f}%")
    print("  1マスずつ試す(O1) 置き/外し/当て:",q([r['place'] for r in o1]),q([r['remove'] for r in o1]),q([r['guess'] for r in o1]),"外し0",f"{100*sum(1 for r in o1 if r['remove']==0)/len(o1):.0f}%")
    print("  計算しないで試す(O3) 置き/外し:",q([r['place'] for r in o3]),q([r['remove'] for r in o3]),"打ち切り",o3cap)
    if cb: print("  組で試す(O1) 置き/外し/組:",q([r['place'] for r in cb]),q([r['remove'] for r in cb]),q([r['tries'] for r in cb]),"外し0",f"{100*sum(1 for r in cb if r['remove']==0)/len(cb):.0f}%","外し4以下",f"{100*sum(1 for r in cb if r['remove']<=4)/len(cb):.0f}%","打ち切り",cbcap)
    print("  組の数 2マス空き:",q(cmb2),"3マス空き:",q(cmb3))
