const API_BASE = "";


/* =========================
   TOKEN
========================= */

function salvarToken(token) {
    localStorage.setItem("zyterra_token", token);
}

function obterToken() {
    return localStorage.getItem("zyterra_token");
}

function removerToken() {
    localStorage.removeItem("zyterra_token");
}


/* =========================
   LOGIN
========================= */

async function login(email, senha) {

    const resposta = await fetch(
        "/api/auth/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                senha: senha
            })
        }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.detail || "E-mail ou senha inválidos."
        );
    }

    salvarToken(dados.access_token);

    return dados;
}


/* =========================
   CADASTRO
========================= */

async function cadastrar(nome, email, senha, telefone) {

    const resposta = await fetch(
        "/api/auth/register",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome: nome,
                email: email,
                senha: senha,
                telefone: telefone || null
            })
        }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.detail || "Não foi possível criar a conta."
        );
    }

    return dados;
}


/* =========================
   PERFIL
========================= */

async function obterPerfil() {

    const token = obterToken();

    if (!token) {
        window.location.href = "/";
        return null;
    }

    const resposta = await fetch(
        "/api/perfil",
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    );

    if (resposta.status === 401) {
        removerToken();
        window.location.href = "/";
        return null;
    }

    const dados = await resposta.json();

    return dados.usuario;
}


/* =========================
   ATUALIZAR PERFIL
========================= */

async function atualizarPerfil(nome, telefone) {

    const token = obterToken();

    if (!token) {
        window.location.href = "/";
        return null;
    }

    const resposta = await fetch(
        "/api/perfil",
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                nome: nome,
                telefone: telefone || null
            })
        }
    );

    if (resposta.status === 401) {
        removerToken();
        window.location.href = "/";
        return null;
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.detail || "Não foi possível atualizar o perfil."
        );
    }

    return dados.usuario;
}


/* =========================
   SAIR
========================= */

function sair() {
    removerToken();
    window.location.href = "/";
}


/* =========================
   FORMULÁRIO DE LOGIN
========================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const email = document
            .getElementById("email")
            .value
            .trim();

        const senha = document
            .getElementById("senha")
            .value;

        const mensagem = document.getElementById("mensagem");

        mensagem.style.color = "#667085";
        mensagem.textContent = "Entrando...";

        try {

            await login(email, senha);

            mensagem.style.color = "#027a48";
            mensagem.textContent = "Login realizado. Abrindo ZyTerra...";

            setTimeout(function() {
                window.location.href = "/painel";
            }, 500);

        } catch (erro) {

            mensagem.style.color = "#b42318";
            mensagem.textContent = erro.message;

        }

    });
}


/* =========================
   FORMULÁRIO DE CADASTRO
========================= */

const cadastroForm = document.getElementById("cadastroForm");

if (cadastroForm) {

    cadastroForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const nome = document
            .getElementById("nome")
            .value
            .trim();

        const email = document
            .getElementById("email")
            .value
            .trim();

        const telefone = document
            .getElementById("telefone")
            .value
            .trim();

        const senha = document
            .getElementById("senha")
            .value;

        const mensagem = document.getElementById("mensagem");

        mensagem.style.color = "#667085";
        mensagem.textContent = "Criando conta...";

        try {

            await cadastrar(
                nome,
                email,
                senha,
                telefone
            );

            mensagem.style.color = "#027a48";
            mensagem.textContent =
                "Conta criada com sucesso. Indo para o login...";

            setTimeout(function() {
                window.location.href = "/";
            }, 1000);

        } catch (erro) {

            mensagem.style.color = "#b42318";
            mensagem.textContent = erro.message;

        }

    });
}
