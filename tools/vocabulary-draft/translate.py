"""Temporary drafting job: only public vocabulary cues; results require review."""
import concurrent.futures
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

root = pathlib.Path(__file__).parent
requests = json.loads((root / 'requests.json').read_text())
output = {}

def translate(language):
    target = 'zh-CN' if language == 'zh-Hans' else language
    cues = list(dict.fromkeys(row['english'] for row in requests if row['language'] == language))
    translated = {}
    def batch(items):
        query = '\n'.join(f'{i + 1}. {text}' for i, text in enumerate(items))
        url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode({
            'client': 'gtx', 'sl': 'en', 'tl': target, 'dt': 't', 'q': query,
        })
        for attempt in range(5):
            try:
                with urllib.request.urlopen(url, timeout=45) as response:
                    data = json.load(response)
                text = ''.join(segment[0] or '' for segment in data[0] if segment)
                markers = list(re.finditer(r'(?m)(?:^|\n)\s*(\d+)[.\u3001\uff0e)]\s*', text))
                if [int(m[1]) for m in markers] == list(range(1, len(items) + 1)):
                    result = [text[m.end():markers[i + 1].start() if i + 1 < len(markers) else len(text)].strip() for i, m in enumerate(markers)]
                    if all(result):
                        return result
                if len(items) == 1 and text.strip():
                    return [re.sub(r'^\s*1[.\u3001\uff0e)]\s*', '', text).strip()]
                break
            except Exception as error:
                print(language, 'retry', attempt + 1, type(error).__name__, flush=True)
                if attempt == 4:
                    raise
                time.sleep(min(20, 2 ** attempt))
        middle = max(1, len(items) // 2)
        return batch(items[:middle]) + batch(items[middle:])
    for start in range(0, len(cues), 25):
        items = cues[start:start + 25]
        result = batch(items)
        assert len(result) == len(items)
        translated.update(zip(items, result))
        print(language, min(start + 25, len(cues)), '/', len(cues), flush=True)
        time.sleep(0.8)
    return language, translated

try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for language, result in executor.map(translate, ['pt', 'zh-Hans', 'th']):
            output[language] = result
            (root / 'output.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
finally:
    print('Completed languages:', list(output), flush=True)
