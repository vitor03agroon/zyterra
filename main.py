from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import json
import os
import unicodedata

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from jose import JWTError, jwt
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from database.database import Base, engine, get_db
from database.models import Usuario


# ============================================================
# APP
# ============================================================

app = FastAPI(title="ZyTerra")


# ============================================================
# BANCO DE DADOS
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# AUTENTICAÇÃO
# ============================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY não configurada. "
        "Configure essa variável no ambiente do ZyTerra."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

password_hash = PasswordHash.recommended()
security = HTTPBearer()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ARQUIVOS ESTÁTICOS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)


# ============================================================
# HELPERS
# ============================================================

def file_response(path: str):
    full = STATIC_DIR / path

    if full.is_file():

        if full.suffix == ".html":
            return HTMLResponse(
                full.read_text(encoding="utf-8")
            )

        if full.suffix == ".json":
            with open(full, encoding="utf-8") as f:
                return JSONResponse(content=json.load(f))

        return FileResponse(full)

    return None


def normalizar(texto: str) -> str:
    texto = texto.lower()

    texto = unicodedata.normalize(
        "NFD",
        texto,
    )

    texto = "".join(
        c
        for c in texto
        if unicodedata.category(c) != "Mn"
    )

    return texto


# ============================================================
# JWT
# ============================================================

def criar_token(usuario_id: int):
    agora = datetime.utcnow()

    expiracao = agora + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(usuario_id),
        "iat": agora,
        "exp": expiracao,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def obter_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        usuario_id = payload.get("sub")

        if not usuario_id:
            raise HTTPException(
                status_code=401,
                detail="Token inválido",
            )

        usuario_id = int(usuario_id)

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Token inválido ou expirado",
        )

    usuario = (
        db.query(Usuario)
        .filter(Usuario.id == usuario_id)
        .first()
    )

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Usuário não encontrado",
        )

    return usuario


# ============================================================
# MODELOS DE USUÁRIO
# ============================================================

class CadastroUsuario(BaseModel):
    nome: str
    email: str
    senha: str
    telefone: Optional[str] = None


class LoginUsuario(BaseModel):
    email: str
    senha: str


class AtualizarPerfil(BaseModel):
    nome: str
    telefone: Optional[str] = None


# ============================================================
# CADASTRO
# ============================================================

@app.post("/api/auth/register")
def registrar_usuario(
    dados: CadastroUsuario,
    db: Session = Depends(get_db),
):
    email = dados.email.strip().lower()
    nome = dados.nome.strip()

    if not nome:
        raise HTTPException(
            status_code=400,
            detail="Nome é obrigatório",
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="E-mail é obrigatório",
        )

    if len(dados.senha) < 6:
        raise HTTPException(
            status_code=400,
            detail="A senha deve ter pelo menos 6 caracteres",
        )

    usuario_existente = (
        db.query(Usuario)
        .filter(Usuario.email == email)
        .first()
    )

    if usuario_existente:
        raise HTTPException(
            status_code=409,
            detail="E-mail já cadastrado",
        )

    usuario = Usuario(
        nome=nome,
        email=email,
        senha_hash=password_hash.hash(dados.senha),
        telefone=dados.telefone,
    )

    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return {
        "ok": True,
        "mensagem": "Usuário cadastrado com sucesso",
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
        },
    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/auth/login")
def login_usuario(
    dados: LoginUsuario,
    db: Session = Depends(get_db),
):
    email = dados.email.strip().lower()

    usuario = (
        db.query(Usuario)
        .filter(Usuario.email == email)
        .first()
    )

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="E-mail ou senha inválidos",
        )

    senha_valida = password_hash.verify(
        dados.senha,
        usuario.senha_hash,
    )

    if not senha_valida:
        raise HTTPException(
            status_code=401,
            detail="E-mail ou senha inválidos",
        )

    token = criar_token(usuario.id)

    return {
        "ok": True,
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
        },
    }


# ============================================================
# PERFIL
# ============================================================

@app.get("/api/perfil")
def obter_perfil(
    usuario: Usuario = Depends(obter_usuario_atual),
):
    return {
        "ok": True,
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
            "criado_em": usuario.criado_em,
        },
    }


# ============================================================
# ATUALIZAR PERFIL
# ============================================================

@app.put("/api/perfil")
def atualizar_perfil(
    dados: AtualizarPerfil,
    usuario: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
):
    nome = dados.nome.strip()

    if not nome:
        raise HTTPException(
            status_code=400,
            detail="Nome é obrigatório",
        )

    usuario.nome = nome
    usuario.telefone = dados.telefone

    db.commit()
    db.refresh(usuario)

    return {
        "ok": True,
        "mensagem": "Perfil atualizado com sucesso",
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
        },
    }


# ============================================================
# ROTAS HTML
# ============================================================

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


# ============================================================
# STATUS
# ============================================================

@app.get("/status")
def status():
    return {
        "ok": True,
        "app": "ZyTerra online",
        "database": True,
    }


# ============================================================
# IA PECUÁRIA — EDUCATIVA
# ============================================================

class PerguntaIA(BaseModel):
    pergunta: str


@app.post("/api/ia/pecuaria")
def ia_pecuaria(data: PerguntaIA):
    pergunta = normalizar(data.pergunta)

    categoria = "Orientação Geral"
    resposta_md = ""

    # --------------------------------------------------------
    # ESTRESSE TÉRMICO / AMBIENTE
    # --------------------------------------------------------

    if (
        "calor" in pergunta
        or "estresse termico" in pergunta
    ):
        categoria = "Manejo / Ambiente"

        resposta_md = """
### Estresse térmico em bovinos

O estresse por calor pode prejudicar o desempenho do rebanho.

Pode causar:

- Redução do consumo alimentar
- Queda no ganho de peso
- Diminuição da produção de leite
- Alterações reprodutivas

**Boas práticas:**

- Sombreamento adequado
- Água limpa e fresca em abundância
- Manejo nos horários mais frescos do dia
"""

    # --------------------------------------------------------
    # NUTRIÇÃO
    # --------------------------------------------------------

    elif any(
        p in pergunta
        for p in [
            "aliment",
            "racao",
            "nutri",
            "pasto",
            "pastagem",
            "suplement",
            "mineral",
        ]
    ):
        categoria = "Nutrição"

        resposta_md = """
### Nutrição na pecuária

Problemas nutricionais podem afetar diretamente o desempenho produtivo.

**Principais fatores:**

- Pastagens de baixa qualidade
- Suplementação inadequada
- Deficiência mineral

Uma dieta equilibrada contribui para o desempenho do rebanho.
"""

    # --------------------------------------------------------
    # SANIDADE
    # --------------------------------------------------------

    elif any(
        p in pergunta
        for p in [
            "doenca",
            "verme",
            "vermin",
            "parasita",
            "febre",
            "diarreia",
        ]
    ):
        categoria = "Sanidade"

        resposta_md = """
### Sanidade animal

Problemas sanitários podem reduzir o desempenho e aumentar perdas produtivas.

**Medidas importantes:**

- Vermifugação estratégica
- Vacinação conforme calendário
- Monitoramento clínico do rebanho
"""

    # --------------------------------------------------------
    # PESO / DESEMPENHO
    # --------------------------------------------------------

    elif any(
        p in pergunta
        for p in [
            "peso",
            "ganho",
            "perda",
            "queda",
            "emagrec",
            "engorda",
            "desempenho",
        ]
    ):
        categoria = "Desempenho Produtivo"

        resposta_md = """
### Desempenho produtivo do rebanho

Alterações no ganho ou perda de peso podem estar relacionadas a:

- Nutrição inadequada
- Parasitismo
- Doenças
- Estresse térmico
- Falhas de manejo

A avaliação integrada é importante para identificar a causa.
"""

    # --------------------------------------------------------
    # FALLBACK
    # --------------------------------------------------------

    else:
        resposta_md = """
### Avaliação geral na pecuária

Problemas produtivos raramente possuem uma única causa.

Recomenda-se avaliar de forma integrada:

- Nutrição
- Sanidade
- Manejo
- Ambiente

Quando necessário, procure um profissional habilitado.
"""

    resposta_md += (
        "\n\n"
        "⚠️ *As informações são educativas e não substituem "
        "a avaliação de um profissional habilitado.*"
    )

    return {
        "categoria": categoria,
        "resposta": resposta_md,
    }


# ============================================================
# FALLBACK
# ============================================================

@app.get("/{path:path}")
def fallback(path: str):
    res = file_response(path)

    if res:
        return res

    return HTMLResponse(
        "<h3>404 - Página não encontrada</h3>",
        status_code=404,
    )
