import subprocess, sys
# 使い方: pick-hunks.py <worktree> <ファイル> <含める語> -> 語を含む hunk だけの patch を標準出力に出す
worktree, path, keyword = sys.argv[1:4]
diff = subprocess.run(["git", "-C", worktree, "diff", "--", path], capture_output=True, text=True).stdout
lines = diff.split("\n")
header, hunks, current = [], [], None
for line in lines:
    if line.startswith("@@"):
        current = [line]
        hunks.append(current)
    elif current is None:
        header.append(line)
    else:
        current.append(line)
picked = [h for h in hunks if any(keyword in l for l in h if l.startswith(("+", "-")))]
if picked:
    out = "\n".join(header + [l for h in picked for l in h])
    if not out.endswith("\n"):
        out += "\n"
    sys.stdout.write(out)
