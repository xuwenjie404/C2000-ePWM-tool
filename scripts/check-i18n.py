"""粗略检查：组件里是否还有「没走 t()」的中文字面量。

不是 AST 分析，只做启发式扫描，用来发现遗漏：
- 跳过 `//` 与 `/* */` 注释
- 跳过已经包在 t('中文', 'English') 里的中文
- 其余含中文的行都报出来，人工确认
"""
import glob
import re

CJK = re.compile(r'[\u4e00-\u9fa5]')

def strip_comments(src: str) -> str:
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'^\s*//.*$', '', src, flags=re.M)
    return src

def strip_t_calls(src: str) -> str:
    """把 t('...', '...') 里第一个中文字符串抹掉，剩下的中文就是可疑项。"""
    out = []
    i = 0
    n = len(src)
    while i < n:
        if src[i] == 't' and i + 1 < n and src[i + 1] == '(':
            # 找到配对括号
            depth = 0
            j = i + 1
            while j < n:
                if src[j] == '(':
                    depth += 1
                elif src[j] == ')':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            inner = src[i + 2:j]
            # 只保留第二段（英文），抹掉第一段中文
            parts = inner.split(',', 1)
            rest = parts[1] if len(parts) > 1 else ''
            out.append('t(' + rest + ')')
            i = j + 1
        else:
            out.append(src[i])
            i += 1
    return ''.join(out)

files = sorted(glob.glob('src/components/*.tsx'))
total = 0
for path in files:
    src = open(path, encoding='utf-8').read()
    body = strip_t_calls(strip_comments(src))
    hits = []
    for no, line in enumerate(body.split('\n'), 1):
        if CJK.search(line):
            hits.append((no, line.strip()[:90]))
    if hits:
        total += len(hits)
        print(f'\n{path}: {len(hits)} 处可疑')
        for no, line in hits[:12]:
            print(f'  {no}: {line}')
print(f'\n合计可疑行: {total}')
