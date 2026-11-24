"""覆面算の導入判断: 同じ式の解の数を、覆面算のルール・違う文字に同じ数字を許すルール・位置ごとに独立の空欄の3通りで数える。"""
def count(addends, result, distinct):
    words = addends + [result]
    L = len(result)
    lead = {w[0] for w in words if len(w) > 1}
    cols = [[w[-1-i] for w in addends if i < len(w)] for i in range(L)]
    n = 0
    def col(i, carry, asg, used):
        nonlocal n
        if i == L:
            n += carry == 0
            return
        free = [c for c in dict.fromkeys(cols[i]) if c not in asg]
        def pick(k, used):
            if k < len(free):
                c = free[k]
                for v in range(10):
                    if (v == 0 and c in lead) or (distinct and v in used):
                        continue
                    asg[c] = v; pick(k + 1, used | {v}); del asg[c]
                return
            s = sum(asg[c] for c in cols[i]) + carry
            d, nc, r = s % 10, s // 10, result[-1-i]
            if r in asg:
                if asg[r] == d: col(i + 1, nc, asg, used)
            elif not (d == 0 and r in lead) and not (distinct and d in used):
                asg[r] = d; col(i + 1, nc, asg, used | {d}); del asg[r]
        pick(0, used)
    col(0, 0, {}, frozenset())
    return n

def blanks(addends, result):
    la, lb, lr = map(len, addends + [result])
    n = 0
    for x in range(10**(la-1), 10**la):
        lo = max(10**(lb-1), 10**(lr-1) - x); hi = min(10**lb - 1, 10**lr - 1 - x)
        n += max(0, hi - lo + 1)
    return n

for a, r in [(["EG","GG"],"EAC"), (["WFX","TFM"],"CMMW"), (["SEND","MORE"],"MONEY")]:
    print("+".join(a)+"="+r, count(a, r, True), count(a, r, False), blanks(a, r))
