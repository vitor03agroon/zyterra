from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import unicodedata

app = FastAPI()

# --------------------------
# CORS (web + mobile)
# --------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# STATIC FILES
# --------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")

# --------------------------
# HELPERS
# --------------------------
def file_response(path: str):
    full = os.path.join("static", path)

    if os.path.isfile(full):
        if full.endswith(".html"):
            with open(full, encoding="utf-8") as f:
                return HTMLResponse(f.read())

        if full.endswith(".json"):
            with open(full, encoding="utf-8") as f:
                return JSONResponse(content=json.load(f))

        return FileResponse(full)

    return None


def normalizar(texto: str) -> str:
    texto = texto.lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto

# --------------------------
# ROTAS HTML
# --------------------------
@app.get("/", response_class=HTMLResponse)
def home():
    return file_response("index.html")

@app.get("/culturas", response_class=HTMLResponse)
def culturas():
    return file_response("culturas.html")

@app.get("/analises", response_class=HTMLResponse)
def analises():
    return file_response("analises.html")

@app.get("/pecuaria", response_class=HTMLResponse)
def pecuaria():
    return file_response("pecuaria.html")

# --------------------------
# STATUS
# --------------------------
@app.get("/status")
def status():
    return {"ok": True, "app": "ZyTerra online"}

# --------------------------
# IA PECUÁRIA — EDUCATIVA (COM CATEGORIA + MARKDOWN)
# --------------------------
class PerguntaIA(BaseModel):
    pergunta: str

@app.post("/api/ia/pecuaria")
def ia_pecuaria(data: PerguntaIA):
    pergunta = normalizar(data.pergunta)

    categoria = "Orientação Geral"
    resposta_md = ""

    # ESTRESSE TÉRMICO / AMBIENTE
    if "calor" in pergunta or "estresse termico" in pergunta:
        categoria = "Manejo / Ambiente"
        resposta_md = """
### Estresse térmico em bovinos

O estresse por calor **prejudica o gado** e pode causar:

- Redução do consumo alimentar  
- Queda no ganho de peso  
- Diminuição da produção de leite  
- Alterações reprodutivas  

**Boas práticas recomendadas:**
- Sombreamento adequado
- Água limpa e fresca em abundância
- Manejo nos horários mais frescos do dia
"""

    # NUTRIÇÃO
    elif any(p in pergunta for p in [
        "aliment", "racao", "nutri", "pasto", "pastagem", "suplement", "mineral"
    ]):
        categoria = "Nutrição"
        resposta_md = """
### Nutrição na pecuária

Problemas nutricionais afetam diretamente o desempenho produtivo.

**Principais fatores:**
- Pastagens de baixa qualidade
- Suplementação inadequada
- Deficiência mineral

Uma dieta equilibrada melhora ganho de peso, produção e sanidade.
"""

    # SANIDADE
    elif any(p in pergunta for p in [
        "doenca", "verme", "vermin", "parasita", "febre", "diarreia"
    ]):
        categoria = "Sanidade"
        resposta_md = """
### Sanidade animal

Problemas sanitários reduzem o desempenho e aumentam perdas produtivas.

**Medidas essenciais:**
- Vermifugação estratégica
- Vacinação conforme calendário
- Monitoramento clínico do rebanho
"""

    # PESO / DESEMPENHO
    elif any(p in pergunta for p in [
        "peso", "ganho", "perda", "queda", "emagrec", "engorda", "desempenho"
    ]):
        categoria = "Desempenho Produtivo"
        resposta_md = """
### Desempenho produtivo do rebanho

Alterações no ganho ou perda de peso podem estar relacionadas a:

- Nutrição inadequada
- Parasitismo
- Doenças
- Estresse térmico
- Falhas de manejo

A avaliação integrada é essencial para correção do problema.
"""

    # FALLBACK INTELIGENTE
    else:
        resposta_md = """
### Avaliação geral na pecuária

Problemas produtivos raramente têm uma única causa.

Recomenda-se avaliar de forma integrada:
- Nutrição
- Sanidade
- Manejo
- Ambiente

Quando necessário, procure um profissional habilitado.
"""

    resposta_md += "\n\n⚠️ *As informações são educativas e não substituem a avaliação de um profissional habilitado.*"

    return {
        "categoria": categoria,
        "resposta": resposta_md
    }

# --------------------------
# FALLBACK
# --------------------------
@app.get("/{path:path}")
def fallback(path: str):
    res = file_response(path)
    if res:
        return res
    return HTMLResponse("<h3>404 - Página não encontrada</h3>", status_code=404)
