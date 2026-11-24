import sys, time
sys.path.insert(0, sys.argv[1])
from common import *
for (n,T,k) in [(4,2,0),(5,2,0),(5,3,1),(5,3,12),(6,2,0),(6,3,12),(5,2,12)]:
    t=time.time()
    c = m.generate_candidate(n,T,k,0)
    t1=time.time()
    lv,f,res = level(n,c["givens"])
    print(n,T,k,c["id"], "gen %.2fs"%(t1-t), "read %.3fs"%(time.time()-t1), "L",lv)
