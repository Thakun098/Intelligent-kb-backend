import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize
from pythainlp.corpus.common import thai_words
from pythainlp.util.trie import dict_trie

app = FastAPI(title="Thai NLP Tokenizer Sidecar Service")

# ── Custom vocabulary (build once at startup) ──────────────────────────
CUSTOM_WORDS = {
    # AI / Tech stack
    "bge-m3", "pgvector", "ollama", "qwen2.5", "nomic-embed-text",
    "intelligent-kb-system", "embedding", "chunking", "retrieval",
    "post-mortem", "hotfix", "rollback", "downtime", "uptime",
    # HR domain
    "ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาคลอด", "วันทำการ",
}
CUSTOM_TRIE = dict_trie(thai_words().union(CUSTOM_WORDS))

# ── Models ─────────────────────────────────────────────────────────────
class TokenizeRequest(BaseModel):
    text: str
    engine: str = "newmm"   # newmm | attacut | longest | icu

class TokenizeResponse(BaseModel):
    tokens: list[str]
    joined: str

class BatchTokenizeRequest(BaseModel):
    texts: list[str]
    engine: str = "newmm"

class BatchTokenizeResponse(BaseModel):
    results: list[TokenizeResponse]

# ── Helpers ────────────────────────────────────────────────────────────
def normalize_text(text: str) -> str:
    text = text.replace('\u200b', '')  # zero-width space
    text = text.replace('\ufeff', '')  # BOM
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def _tokenize(text: str, engine: str) -> TokenizeResponse:
    if not text:
        return TokenizeResponse(tokens=[], joined="")
    cleaned = normalize_text(text)
    tokens = word_tokenize(
        cleaned,
        custom_dict=CUSTOM_TRIE,
        engine=engine,
        keep_whitespace=False
    )
    return TokenizeResponse(tokens=tokens, joined=" ".join(tokens))

# ── Endpoints ──────────────────────────────────────────────────────────
@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize_text(payload: TokenizeRequest):
    try:
        return _tokenize(payload.text, payload.engine)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tokenize/batch", response_model=BatchTokenizeResponse)
def tokenize_batch(payload: BatchTokenizeRequest):
    try:
        return BatchTokenizeResponse(
            results=[_tokenize(t, payload.engine) for t in payload.texts]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "thai-nlp"}