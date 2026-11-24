p='/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/frontend/src/components/HowToPlayPhrases.tsx'
s=open(p,encoding='utf-8').read()
old='''  // まとめると前の行が短くなった文と、そのときの文の列の幅。幅が変わるまで、その文はまとめずに描く。
  const [unbound, setUnbound] = useState<{
    text: string;
    width: number;
  } | null>(null);
  const unboundWidth = unbound?.text === text ? unbound.width : null;
  const lastRef = useRef<HTMLSpanElement>(null);
  const phrases = binds && unboundWidth === null ? bound : split;
'''
new='''  // まとめると前の行が短くなった文。文の列の幅が変わるまで、その文はまとめずに描く。
  const [unboundText, setUnboundText] = useState<string | null>(null);
  const unbinds = unboundText === text;
  const lastRef = useRef<HTMLSpanElement>(null);
  const phrases = binds && !unbinds ? bound : split;
'''
assert s.count(old)==1
s=s.replace(old,new)
old2='''    if (unboundWidth === null && leavesShortPreviousLine(last)) {
      setUnbound({ text, width: column.clientWidth });
      return;
    }'''
new2='''    if (!unbinds && leavesShortPreviousLine(last)) {
      setUnboundText(text);
      return;
    }'''
assert s.count(old2)==1
s=s.replace(old2,new2)
old3='''      if (unboundWidth !== null) {
        setUnbound(null);
      } else if (leavesShortPreviousLine(last)) {
        setUnbound({ text, width: column.clientWidth });
      }
    });
    resizes.observe(column);
    return () => resizes.disconnect();
  }, [binds, text, unboundWidth]);'''
new3='''      if (unbinds) {
        setUnboundText(null);
      } else if (leavesShortPreviousLine(last)) {
        setUnboundText(text);
      }
    });
    resizes.observe(column);
    return () => resizes.disconnect();
  }, [binds, text, unbinds]);'''
assert s.count(old3)==1
s=s.replace(old3,new3)
open(p,'w',encoding='utf-8').write(s)
print('patched')
