from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize

app = FastAPI(title="Thai NLP Tokenizer Sidecar Service")

class TokenizeRequest(BaseModel):
    text: str

class TokenizeResponse(BaseModel):
    tokens: list[str]
    joined: str

@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize_text(payload: TokenizeRequest):
    try:
        if not payload.text:
            return TokenizeResponse(tokens=[], joined="")
        
        # Tokenize Thai text using PyThaiNLP engine
        # default engine uses newmm
        tokens = word_tokenize(payload.text, keep_whitespace=False)
        joined = " ".join(tokens)
        
        return TokenizeResponse(tokens=tokens, joined=joined)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "thai-nlp"}
