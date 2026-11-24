import ast, re, sys
research, frozen = sys.argv[1], sys.argv[2]
src = open(research, encoding="utf-8").read()
tree = ast.parse(src)
lines = src.splitlines()
current = {}
for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
        start = (node.decorator_list[0].lineno if node.decorator_list else node.lineno)
        current[node.name] = "\n".join(lines[start - 1:node.end_lineno])
fro = open(frozen, encoding="utf-8").read()
parts = re.split(r"^# --- (\w+) \(lines [0-9-]+\)\n", fro, flags=re.M)[1:]
for name, body in zip(parts[0::2], parts[1::2]):
    now = current.get(name)
    same = now is not None and now.strip() == body.strip()
    print(name, "same" if same else ("missing" if now is None else "CHANGED"))
for helper in ("bits", "popcount"):
    print(helper, "present" if helper in current else "missing", current.get(helper, "").strip()[:200].replace("\n", " | "))
