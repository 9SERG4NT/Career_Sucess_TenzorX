# backend/agents/knowledge.py
"""
Lightweight retrieval (RAG) over PlacementIQ product docs (README + PRD).

Uses TF-IDF (scikit-learn — already a dependency) instead of an embedding model
or vector DB. For a small, curated corpus this is accurate enough, stays 100%
free, and works fully offline. If the corpus grows large, swap _KnowledgeIndex
for a sentence-transformers + FAISS implementation behind the same retrieve() API.
"""
import os
import re
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# agents/ -> backend/ -> project root (where README.md / PRD live)
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_SOURCES = ["README.md", "PlacementIQ_PRD_v2.md"]
_MAX_CHARS = 900
_MIN_SCORE = 0.03


def _strip_md(text: str) -> str:
    """Reduce markdown to plain prose so TF-IDF isn't polluted by syntax."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)   # fenced code
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)          # images
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)        # links -> label
    text = re.sub(r"<[^>]+>", " ", text)                        # html/jsx tags
    text = re.sub(r"[#>*_`|]+", " ", text)                      # md symbols
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _chunk_doc(text: str, source: str) -> list[dict]:
    """Split on markdown headings, packing each section into <=_MAX_CHARS chunks.
    The nearest heading is kept as a human-readable title for citation."""
    chunks: list[dict] = []
    buf: list[str] = []
    title = source
    length = 0

    def flush(cur_title):
        nonlocal buf, length
        body = _strip_md(" ".join(buf))
        if len(body) > 40:
            chunks.append({"source": source, "title": cur_title, "text": body})
        buf, length = [], 0

    for line in text.splitlines():
        heading = re.match(r"^#{1,4}\s+(.*)", line)
        if heading:
            flush(title)
            title = heading.group(1).strip()[:80] or source
        buf.append(line)
        length += len(line)
        if length >= _MAX_CHARS:
            flush(title)
    flush(title)
    return chunks


class _KnowledgeIndex:
    def __init__(self):
        self.chunks: list[dict] = []
        for src in _SOURCES:
            path = os.path.join(_ROOT, src)
            if os.path.exists(path):
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    self.chunks.extend(_chunk_doc(fh.read(), src))

        self.ready = len(self.chunks) > 0
        if self.ready:
            self.vectorizer = TfidfVectorizer(
                stop_words="english", ngram_range=(1, 2), min_df=1
            )
            self.matrix = self.vectorizer.fit_transform(c["text"] for c in self.chunks)

    def search(self, query: str, k: int = 4) -> list[dict]:
        if not self.ready or not (query or "").strip():
            return []
        qv = self.vectorizer.transform([query])
        sims = cosine_similarity(qv, self.matrix)[0]
        order = sims.argsort()[::-1][:k]
        results = []
        for i in order:
            if sims[i] < _MIN_SCORE:
                continue
            results.append({**self.chunks[i], "score": round(float(sims[i]), 3)})
        return results


@lru_cache(maxsize=1)
def get_index() -> _KnowledgeIndex:
    return _KnowledgeIndex()


def retrieve(query: str, k: int = 4) -> list[dict]:
    """Return up to k relevant doc chunks: {source, title, text, score}."""
    try:
        return get_index().search(query, k)
    except Exception:
        return []
