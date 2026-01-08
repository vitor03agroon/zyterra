/* ============================================================
   ZYTERRA — MÓDULO IA ULTRA PARA INSUMOS AGRÍCOLAS
   Parte 1 — Núcleo do sistema, carregamento de bases e NLU 
   ============================================================ */

/* ---------------------------------------------
   OBJETO GLOBAL DO SISTEMA
--------------------------------------------- */
window.ZyIA = {
    produto: null,
    bancos: {
        insumos: null,
        culturas: null,
        daninhas: null,
        hrac: null,
        frac: null,
        irac: null,
        pragas: null,
        doencas: null
    },
    carregado: false
};


/* ---------------------------------------------
   FUNÇÃO PRINCIPAL DE CARREGAMENTO
--------------------------------------------- */
async function ZyLoadIA(produtoNome) {
    try {
        const bases = await Promise.all([
            fetch('/static/data/insumos_agricolas.json').then(r => r.json()),
            fetch('/static/data/compat_culturas.json').then(r => r.json()),
            fetch('/static/data/plantas_daninhas.json').then(r => r.json()),
            fetch('/static/data/hrac.json').then(r => r.json()),
            fetch('/static/data/frac.json').then(r => r.json()),
            fetch('/static/data/irac.json').then(r => r.json()),
            fetch('/static/data/alvos_pragas.json').then(r => r.json()).catch(() => ({})),
            fetch('/static/data/alvos_doencas.json').then(r => r.json()).catch(() => ({}))
        ]);

        ZyIA.bancos.insumos = bases[0];
        ZyIA.bancos.culturas = bases[1];
        ZyIA.bancos.daninhas = bases[2];
        ZyIA.bancos.hrac = bases[3];
        ZyIA.bancos.frac = bases[4];
        ZyIA.bancos.irac = bases[5];
        ZyIA.bancos.pragas = bases[6];
        ZyIA.bancos.doencas = bases[7];

        // localiza produto
        ZyIA.produto = ZyFindProduct(produtoNome);
        ZyIA.carregado = true;

        return ZyIA.produto;

    } catch (e) {
        console.error("ERRO AO CARREGAR IA:", e);
        return null;
    }
}


/* ---------------------------------------------
   LOCALIZAR PRODUTO EM QUALQUER CATEGORIA
--------------------------------------------- */
function ZyFindProduct(nome) {
    if(!nome || !ZyIA.bancos.insumos) return null;

    nome = nome.toLowerCase();

    const bancos = ZyIA.bancos.insumos;
    for(const cat of Object.keys(bancos)) {
        const arr = bancos[cat] || [];
        for(const p of arr) {
            if(p.nome.toLowerCase() === nome) return p;
        }
        for(const p of arr) {
            if(p.nome.toLowerCase().includes(nome)) return p;
        }
    }

    return null;
}


/* ============================================================
   SISTEMA DE NLP (INTENÇÕES)
   ============================================================ */

/*
   ZyDetectIntent:
   Analisa a frase e identifica a intenção principal do usuário.
   Isso alimenta a IA que gera respostas técnicas.
*/
function ZyDetectIntent(frase) {
    frase = frase.toLowerCase();

    const intents = [
        { test: /(controla|mata|controle)/, intent: "controle" },
        { test: /(dose|quantidade|aplicar|litro|ml|ha)/, intent: "dose" },
        { test: /(soja|milho|feijão|trigo|cana|sorgo|algodão)/, intent: "cultura" },
        { test: /(resiste|resistente|resistência)/, intent: "resistencia" },
        { test: /(mistura|misturar|tanque|compatível)/, intent: "mistura" },
        { test: /(abelha|abelhas|apic|polinizador)/, intent: "abelhas" },
        { test: /(carência|intervalo|reentrada)/, intent: "carencia" },
        { test: /(modo de ação|grupo|hrac|irac|frac|mecanismo)/, intent: "mecanismo" },
        { test: /(programa|manejo|recomendação|como usar)/, intent: "manejo" }
    ];

    for(const it of intents){
        if(it.test.test(frase)) return it.intent;
    }

    return "geral"; // fallback
}


/* ---------------------------------------------
   EXTRAIR CULTURA DA FRASE
--------------------------------------------- */
function ZyExtractCulture(frase){
    frase = frase.toLowerCase();
    const culturas = ["soja", "milho", "feijão", "trigo", "cana", "algodão", "sorgo"];
    for(const c of culturas){
        if(frase.includes(c)) return c;
    }
    return null;
}


/* ---------------------------------------------
   EXTRAIR PLANTA DANINHA
--------------------------------------------- */
function ZyExtractWeed(frase){
    frase = frase.toLowerCase();
    const daninhas = ZyIA.bancos.daninhas || {};
    for(const d of Object.keys(daninhas)){
        const n = daninhas[d].nome.toLowerCase();
        if(frase.includes(n)) return d;
    }
    return null;
}


/* ---------------------------------------------
   EXTRAIR PRAGA
--------------------------------------------- */
function ZyExtractPest(frase){
    frase = frase.toLowerCase();
    const pragas = ZyIA.bancos.pragas || {};
    for(const p of Object.keys(pragas)){
        if(frase.includes(p)) return p;
    }
    return null;
}


/* ---------------------------------------------
   EXTRAIR DOENÇA
--------------------------------------------- */
function ZyExtractDisease(frase){
    frase = frase.toLowerCase();
    const ds = ZyIA.bancos.doencas || {};
    for(const d of Object.keys(ds)){
        if(frase.includes(d)) return d;
    }
    return null;
}
/* ============================================================
   PARTE 2 — ANÁLISE TÉCNICA DO PRODUTO
   Mecanismos HRAC/FRAC/IRAC • Resistência • Cultura • Alvos
   ============================================================ */

/* ---------------------------------------------
   RESPOSTA: MECANISMO DE AÇÃO (HRAC/FRAC/IRAC)
--------------------------------------------- */
function ZyGetMechanism(prod) {
    const hrac = ZyIA.bancos.hrac;
    const frac = ZyIA.bancos.frac;
    const irac = ZyIA.bancos.irac;

    if (prod.grupo_hrac && hrac[prod.grupo_hrac]) {
        return `🔹 <b>Grupo HRAC ${prod.grupo_hrac}</b>: ${hrac[prod.grupo_hrac]}`;
    }
    if (prod.grupo_frac && frac[prod.grupo_frac]) {
        return `🔹 <b>Grupo FRAC ${prod.grupo_frac}</b>: ${frac[prod.grupo_frac]}`;
    }
    if (prod.grupo_irac && irac[prod.grupo_irac]) {
        return `🔹 <b>Grupo IRAC ${prod.grupo_irac}</b>: ${irac[prod.grupo_irac]}`;
    }
    return "ℹ️ Mecanismo não encontrado no banco da IA.";
}


/* ---------------------------------------------
   RESISTÊNCIA — PLANTAS DANINHAS
--------------------------------------------- */
function ZyCheckResistance(prod) {
    const daninhas = ZyIA.bancos.daninhas;
    let res = [];

    for (const d in daninhas) {
        const info = daninhas[d];
        if (info.resistencia && info.resistencia.includes(prod.ingrediente_ativo)) {
            res.push(info.nome);
        }
    }

    if (res.length === 0)
        return "Nenhuma resistência registrada para este ingrediente ativo.";

    return `⚠️ Resistência registrada contra: <b>${res.join(", ")}</b>.`;
}


/* ---------------------------------------------
   CULTURAS COMPATÍVEIS / NÃO COMPATÍVEIS
--------------------------------------------- */
function ZyCheckCultureCompatibility(prod, culture) {
    const banco = ZyIA.bancos.culturas;
    if (!banco[culture]) return `ℹ️ Não há dados de compatibilidade para ${culture}.`;

    const permitido = banco[culture].permitidos || [];
    const proibido = banco[culture].nao_permitidos || [];

    const nome = prod.nome.toLowerCase();
    const ativo = (prod.ingrediente_ativo || "").toLowerCase();

    const ok = permitido.some(x => x.toLowerCase() === nome || x.toLowerCase() === ativo);

    if (ok) return `✅ <b>Compatível com ${culture}</b> (base ZyTerra).`;

    const no = proibido.some(x => x.toLowerCase() === nome || x.toLowerCase() === ativo);

    if (no) return `❌ <b>Não recomendado para ${culture}</b>. Confira bula e registro.`;

    return `⚠️ Compatibilidade não confirmada com ${culture}.`;
}


/* ---------------------------------------------
   AÇÃO SOBRE PLANTA DANINHA (CONTROLE)
--------------------------------------------- */
function ZyCheckWeedControl(prod, weed) {
    const d = ZyIA.bancos.daninhas[weed];
    if (!d) return "ℹ️ Não encontrado no banco de plantas daninhas.";

    const ativo = prod.ingrediente_ativo.toLowerCase();

    const controla = (d.controle_recomendado || [])
        .map(x => x.toLowerCase())
        .includes(ativo);

    const temAlvo = (prod.alvos || []).map(a => a.toLowerCase()).includes(weed);

    if (controla || temAlvo)
        return `✅ <b>${prod.nome}</b> é recomendado para controle de <b>${d.nome}</b>.`;

    return `⚠️ <b>${prod.nome}</b> NÃO é o principal recomendado contra <b>${d.nome}</b>.`;
}


/* ---------------------------------------------
   CONTROLE DE PRAGA
--------------------------------------------- */
function ZyCheckPestControl(prod, pest) {
    const banco = ZyIA.bancos.pragas;
    const lista = banco[pest] || [];

    if (lista.includes(prod.nome))
        return `✅ ${prod.nome} atua contra <b>${pest}</b>.`;

    return `⚠️ ${prod.nome} não é listado para <b>${pest}</b>.`;
}


/* ---------------------------------------------
   CONTROLE DE DOENÇA
--------------------------------------------- */
function ZyCheckDiseaseControl(prod, disease) {
    const banco = ZyIA.bancos.doencas;
    const lista = banco[disease] || [];

    if (lista.includes(prod.nome))
        return `✅ ${prod.nome} é eficaz contra <b>${disease}</b>.`;

    return `⚠️ ${prod.nome} não é indicado como principal opção para <b>${disease}</b>.`;
}


/* ---------------------------------------------
   CHECK ESPECIAL: RISCO APÍCOLA (ABELHAS)
--------------------------------------------- */
function ZyCheckBeeRisk(prod) {
    if (!prod.impacto_abelhas) return "ℹ️ Não há dados de risco apícola.";

    if (prod.impacto_abelhas.toLowerCase() === "alto")
        return "⚠️ <b>Alto risco para abelhas</b> — evite aplicação em floradas.";

    return `ℹ️ Risco apícola: ${prod.impacto_abelhas}`;
}


/* ---------------------------------------------
   CHECK ESPECIAL: FITOTOXICIDADE BASEADA EM CULTURA
--------------------------------------------- */
function ZyCheckPhytotoxicity(prod, culture) {
    if (!culture) return null;

    const banco = ZyIA.bancos.culturas;
    const info = banco[culture];

    if (!info) return null;

    const proibido = (info.nao_permitidos || [])
        .map(x => x.toLowerCase());

    if (proibido.includes(prod.nome.toLowerCase()) ||
        proibido.includes((prod.ingrediente_ativo || "").toLowerCase())) {

        return `❌ Risco de <b>fitotoxicidade</b> para ${culture}.`;
    }

    return `💚 Sem indícios de fitotoxicidade para ${culture}.`;
}
/* ============================================================
   PARTE 3 — MANEJO AGRONÔMICO INTELIGENTE
   Pré • Pós • Residual • Dessecação • Rotação de mecanismos
   ============================================================ */


/* ---------------------------------------------
   SUGESTÃO: PROGRAMA DE MANEJO COMPLETO
--------------------------------------------- */
function ZyBuildManejo(prod, culture = null) {
    let out = [];

    out.push(`<b>PROGRAMA DE MANEJO — ${prod.nome}</b>`);

    /* -------------------------
       1 — PRÉ-PLANTIO / PRÉ
    ------------------------- */
    out.push("<hr>");
    out.push("<b>1) PRÉ-PLANTIO</b>");

    if (prod.categoria.toLowerCase().includes("herbicida")) {
        
        // dessecação padrão
        out.push("• Aplicar em dessecação 10–15 dias antes da semeadura.");

        // herbicidas sistêmicos
        if ((prod.modo_acao || "").toLowerCase().includes("sistêmico")) {
            out.push("• Produto sistêmico — melhor desempenho com plantas ativas (evitar seca extrema).");
        }

        // se cultura for soja
        if (culture === "soja") {
            out.push("• Para buva resistente: combinar com Diclosulam ou 2,4-D.");
        }

        // se cultura for milho
        if (culture === "milho") {
            out.push("• Em milho: considerar atrazina ou mesotriona como parceiros de manejo.");
        }
    }

    /* -------------------------
       2 — PÓS-EMERGÊNCIA
    ------------------------- */
    out.push("<hr>");
    out.push("<b>2) PÓS-EMERGÊNCIA</b>");

    if (prod.categoria.toLowerCase().includes("herbicida")) {
        out.push("• Aplicar com plantas daninhas jovens (2–4 folhas).");
        out.push("• Evitar aplicações acima de 30°C (risco de deriva e evaporação).");

        // resistência → alternativa
        const resCheck = ZyCheckResistance(prod);
        if (resCheck.includes("⚠️")) {
            out.push("• <b>Resistência detectada</b> — alterne com outro mecanismo HRAC.");
        }
    }

    if (prod.categoria.toLowerCase().includes("inseticida")) {
        out.push("• Aplicar no nível de ação (população acima do limiar).");
        out.push("• Alternar grupos IRAC para diminuir risco de resistência.");
    }

    if (prod.categoria.toLowerCase().includes("fungicida")) {
        out.push("• Realizar aplicação preventiva ou no início dos sintomas.");
        out.push("• Alternar triazol ↔ estrobilurina conforme programa FRAC.");
    }

    /* -------------------------
       3 — RESIDUAL
    ------------------------- */
    out.push("<hr>");
    out.push("<b>3) RESIDUAL</b>");

    if (prod.residual) {
        out.push(`• Produto possui residual estimado de <b>${prod.residual}</b>.`);
    } else {
        out.push("• Residual depende de dose, chuva e tipo de solo.");
    }

    /* -------------------------
       4 — ROTAÇÃO DE MECANISMOS
    ------------------------- */
    out.push("<hr>");
    out.push("<b>4) ROTAÇÃO DE MECANISMOS</b>");

    const mech = ZyGetMechanism(prod);
    out.push(`• Mecanismo atual: ${mech}`);

    out.push("• Evitar repetição da mesma molécula por ciclos consecutivos.");
    out.push("• Rotacionar HRAC/FRAC/IRAC para reduzir resistência.");

    /* -------------------------
       5 — CLIMA / HORÁRIO
    ------------------------- */
    out.push("<hr>");
    out.push("<b>5) CONDIÇÕES CLIMÁTICAS</b>");
    out.push("• Evitar aplicações com vento > 10 km/h.");
    out.push("• Evitar aplicações com < 20% de umidade relativa.");
    out.push("• Temperatura ideal: 20–28°C.");

    out.push("• Em seca prolongada: plantas respondem menos — ajuste de adjuvante pode ser necessário.");

    /* -------------------------
       6 — AJUSTE POR CULTURA (se fornecido)
    ------------------------- */
    if (culture) {
        out.push("<hr>");
        out.push(`<b>6) CONSIDERAÇÕES ESPECÍFICAS PARA ${culture.toUpperCase()}</b>`);

        const compat = ZyCheckCultureCompatibility(prod, culture);
        out.push("• " + compat);

        const fito = ZyCheckPhytotoxicity(prod, culture);
        if (fito) out.push("• " + fito);
    }

    /* -------------------------
       7 — SEGURANÇA E EPIs
    ------------------------- */
    out.push("<hr>");
    out.push("<b>7) SEGURANÇA</b>");
    out.push("• Utilizar EPIs completos durante o preparo e aplicação.");
    out.push("• Respeitar período de reentrada conforme bula.");

    /* -------------------------
       8 — FINAL
    ------------------------- */
    out.push("<hr>");
    out.push(`<b>Resumo final:</b> programa montado com base técnica em HRAC/FRAC/IRAC + resistência + cultura + modo de ação.`);

    return out.join("<br>");
}




/* ---------------------------------------------
   SUGESTÃO AUTOMÁTICA (BOTÃO "SUGESTÃO DE MANEJO")
--------------------------------------------- */
function ZyAutoSuggest(prod, culture = null) {
    let sugestao = [];

    sugestao.push(`<b>SUGESTÃO DE MANEJO AUTOMÁTICA — ${prod.nome}</b>`);

    if (prod.categoria.toLowerCase().includes("herbicida")) {
        sugestao.push("• Aplicação ideal: plantas jovens (até 4 folhas).");
        sugestao.push("• Se houver buva resistente: adicionar Diclosulam ou 2,4-D.");
        sugestao.push("• Adjuvante recomendado: óleo mineral ou não-iônico (conforme bula).");
    }

    if (prod.categoria.toLowerCase().includes("inseticida")) {
        sugestao.push("• Aplicar no nível de ação (> limiar).");
        sugestao.push("• Rotacionar IRAC para reduzir resistência.");
    }

    if (prod.categoria.toLowerCase().includes("fungicida")) {
        sugestao.push("• Aplicar preventivo, especialmente antes de períodos de alta umidade.");
        sugestao.push("• Alternar FRAC.");
    }

    if (culture) {
        sugestao.push(`<br><b>Para a cultura: ${culture.toUpperCase()}</b>`);
        sugestao.push(ZyCheckCultureCompatibility(prod, culture));
    }

    sugestao.push("<br>⚠️ Sempre conferir bula e recomendações locais.");

    return sugestao.join("<br>");
}
/* ============================================================
   PARTE 4 — MISTURA EM TANQUE (COMPATIBILIDADE QUÍMICA)
   Regras profissionais • pH • ordem • conflitos • adjuvantes
   ============================================================ */


/* ---------------------------------------------
   ORDEM PROFISSIONAL DE MISTURA — W.A.L.E.S.
   (Water → Agitate → Liquids → Emulsions → Surfactants)
--------------------------------------------- */
function ZyMixingOrder() {
    return `
    <b>ORDEM PROFISSIONAL DE MISTURA (W.A.L.E.S.)</b><br>
    1) <b>A</b>gua no tanque até 30–40%<br>
    2) <b>A</b>gitar sempre durante a mistura<br>
    3) <b>L</b>íquidos solúveis (SL, SC)<br>
    4) <b>E</b>mulcionáveis (EC)<br>
    5) <b>S</b>urfactantes / adjuvantes (por último)<br>
    <br>
    <i>Evite colocar adjuvantes antes dos herbicidas — pode causar gelificação.</i>
    `;
}


/* ---------------------------------------------
   REGRAS DE COMPATIBILIDADE QUÍMICA
--------------------------------------------- */
function ZyCheckMixtureCompatibility(prod) {
    let out = [];

    out.push("<b>ANÁLISE DE COMPATIBILIDADE DE MISTURA</b><br>");

    const categoria = prod.categoria.toLowerCase();
    const ativo = (prod.ingrediente_ativo || "").toLowerCase();

    /* -----------------------------------------
       1 — Herbicidas hormonais (ex: 2,4-D)
    ----------------------------------------- */
    if (ativo.includes("2,4-d") || ativo.includes("24d")) {
        out.push("⚠️ <b>Cuidado</b>: 2,4-D pode causar volatilização → risco alto de deriva.");
        out.push("⚠️ Evitar misturar com glifosato < 15 dias antes da soja.");
        out.push("✔ Misturar com óleo mineral é permitido (consultar bula).");
    }

    /* -----------------------------------------
       2 — Produtos com sal de amônio / sal potássico
    ----------------------------------------- */
    if (ativo.includes("sal") || ativo.includes("amina") || ativo.includes("potássico")) {
        out.push("ℹ️ Produtos salinos podem alterar pH da calda — atenção com produtos ácidos.");
    }

    /* -----------------------------------------
       3 — Glifosato
    ----------------------------------------- */
    if (ativo.includes("glifosato")) {
        out.push("⚠️ Glifosato perde eficiência se misturado com produtos muito básicos.");
        out.push("⚠️ Evitar mistura direta com fertilizantes foliares.");
        out.push("✔ Adjuvante não-iônico melhora absorção.");
    }

    /* -----------------------------------------
       4 — Inseticidas piretroides
    ----------------------------------------- */
    if (categoria.includes("inseticida") && ativo.includes("trina")) {
        out.push("⚠️ Piretróides são sensíveis a pH alto (> 8).");
        out.push("✔ Ajustar pH da calda entre 5.5 e 6.5.");
    }

    /* -----------------------------------------
       5 — Fungicidas triazóis
    ----------------------------------------- */
    if (categoria.includes("fungicida") && ativo.includes("azol")) {
        out.push("ℹ️ Triazóis preferem pH ligeiramente ácido.");
        out.push("✔ Evitar misturar com produtos muito alcalinos.");
    }

    /* -----------------------------------------
       6 — Adjuvantes
    ----------------------------------------- */
    if (categoria.includes("adjuvante")) {
        out.push("✔ Adjuvante melhora espalhamento e aderência.");
        out.push("⚠️ Nunca adicione antes dos herbicidas — pode gelificar.");
    }

    /* -----------------------------------------
       7 — Fertilizantes foliares
    ----------------------------------------- */
    if (categoria.includes("fertilizante")) {
        out.push("⚠️ Fertilizantes foliares NÃO devem ser misturados com glifosato.");
        out.push("ℹ️ Misturar com fungicidas e inseticidas geralmente é possível → fazer jar test.");
    }

    /* -----------------------------------------
       Regras gerais
    ----------------------------------------- */
    out.push("<br><b>REGRAS GERAIS:</b>");
    out.push("• Evite misturar produtos ácidos + básicos no mesmo tanque.");
    out.push("• Evite misturar 3+ herbicidas hormonais.");
    out.push("• Sempre fazer <b>jar test</b> antes de grandes volumes.");

    return out.join("<br>");
}


/* ---------------------------------------------
   JAR TEST (TESTE DE BANCADA INTELIGENTE)
--------------------------------------------- */
function ZyJarTest(prod) {
    let out = [];

    out.push("<b>TESTE DE BANCADA (JAR TEST) — RECOMENDAÇÃO</b><br>");

    out.push("1) Adicione 100 ml de água limpa em um frasco transparente.");
    out.push("2) Reproduza a ordem do tanque (WALES).");
    out.push("3) Adicione <b>primeiro</b> o produto base (SL/SC).");
    out.push("4) Adicione o produto EC em seguida.");
    out.push("5) Agite suavemente por 30 segundos.");
    out.push("6) Observe por:");
    out.push("   • Flocos");
    out.push("   • Gelificação");
    out.push("   • Separação de fases");
    out.push("   • Precipitação");

    out.push("<br>Se qualquer um desses ocorrer → <b>MISTURA INCOMPATÍVEL</b>.");
    out.push("<br>Se estiver homogênea após 5 minutos → <b>compatível</b>.");

    return out.join("<br>");
}


/* ---------------------------------------------
   FINAL — FUNÇÃO COMPLETA DE MISTURA
--------------------------------------------- */
function ZyMix(prod) {
    return `
    ${ZyMixingOrder()}
    <hr>
    ${ZyCheckMixtureCompatibility(prod)}
    <hr>
    ${ZyJarTest(prod)}
    `;
}
/* ============================================================
   PARTE 5 — ANÁLISE CLIMÁTICA INTELIGENTE
   Temperatura • Umidade • Vento • Seca • Chuva
   ============================================================ */


/* ---------------------------------------------
   VERIFICAÇÃO DE TEMPERATURA
--------------------------------------------- */
function ZyCheckTemperature(temp) {
    if (temp < 18)
        return "⚠️ Temperatura baixa (<18°C) → absorção reduzida.";
    if (temp > 32)
        return "⚠️ Temperatura alta (>32°C) → risco de evaporação e deriva.";
    return "✅ Temperatura adequada para aplicação.";
}


/* ---------------------------------------------
   VERIFICAÇÃO DE UMIDADE RELATIVA
--------------------------------------------- */
function ZyCheckHumidity(ur) {
    if (ur < 40)
        return "⚠️ Umidade baixa (<40%) → risco de deriva e menor absorção.";
    if (ur > 85)
        return "⚠️ Umidade muito alta → risco de escorrimento.";
    return "✅ Umidade adequada.";
}


/* ---------------------------------------------
   VERIFICAÇÃO DE VENTO
--------------------------------------------- */
function ZyCheckWind(vento) {
    if (vento > 12)
        return "❌ Vento forte (>12 km/h) → aplicação proibida.";
    if (vento > 8)
        return "⚠️ Vento moderado → risco de deriva, cuidado.";
    return "✅ Vento dentro da faixa aceitável.";
}


/* ---------------------------------------------
   VERIFICAÇÃO DE CHUVA
--------------------------------------------- */
function ZyCheckRain(minutes) {
    if (minutes < 30)
        return "❌ Chuva dentro de 30 min → aplicação totalmente ineficaz.";
    if (minutes < 90)
        return "⚠️ Chuva prevista cedo → risco de lavagem.";
    return "✅ Janela segura quanto a chuva.";
}


/* ---------------------------------------------
   VERIFICAÇÃO DE SECA / ESTRESSE HÍDRICO
--------------------------------------------- */
function ZyCheckDrought(daysWithoutRain) {
    if (daysWithoutRain > 20)
        return "⚠️ Seca severa (>20 dias) → plantas estressadas, baixa absorção.";
    if (daysWithoutRain > 10)
        return "ℹ️ Estresse moderado — ajustar dose e considerar adjuvante.";
    return "✅ Condição hídrica adequada.";
}


/* ---------------------------------------------
   RELATÓRIO CLIMÁTICO COMPLETO
--------------------------------------------- */
function ZyClimateReport(cond) {
    let out = [];
    out.push("<b>AVALIAÇÃO CLIMÁTICA DA APLICAÇÃO</b><br>");

    if (cond.temp != null) out.push("• " + ZyCheckTemperature(cond.temp));
    if (cond.ur != null) out.push("• " + ZyCheckHumidity(cond.ur));
    if (cond.vento != null) out.push("• " + ZyCheckWind(cond.vento));
    if (cond.chuva != null) out.push("• " + ZyCheckRain(cond.chuva));
    if (cond.seca != null) out.push("• " + ZyCheckDrought(cond.seca));

    out.push("<br>⚠️ <i>Lembre-se: plantas estressadas absorvem menos produto.</i>");
    out.push("<br>✔ Ajuste de adjuvante pode melhorar absorção em condições críticas.");

    return out.join("<br>");
}


/* ---------------------------------------------
   FAIXA IDEAL DE CONDIÇÕES
--------------------------------------------- */
function ZyIdealConditions() {
    return `
    <b>FAIXA IDEAL PARA APLICAÇÃO</b><br>
    • Temperatura: 20–28°C<br>
    • Umidade relativa: 50–80%<br>
    • Vento: 3–7 km/h<br>
    • Planta ativa e não estressada<br>
    • Sem previsão de chuva por 2–3 horas<br>
    `;
}
/* ============================================================
   PARTE 6 — MOTOR DE DECISÃO ULTRA
   Geração de respostas inteligentes e completas
   ============================================================ */

/* ---------------------------------------------
   FUNÇÃO PRINCIPAL: ZyAnswer
--------------------------------------------- */
async function ZyAnswer(pergunta) {
    if (!ZyIA.carregado) {
        return "A IA ainda está carregando os dados. Aguarde alguns segundos.";
    }

    const prod = ZyIA.produto;
    pergunta = pergunta.toLowerCase().trim();

    // Identificar intenção
    const intent = ZyDetectIntent(pergunta);

    // Extrações
    const culture = ZyExtractCulture(pergunta);
    const weed = ZyExtractWeed(pergunta);
    const pest = ZyExtractPest(pergunta);
    const disease = ZyExtractDisease(pergunta);

    let out = [];
    out.push(`<b>${prod.nome}</b> — resposta técnica baseada na sua pergunta:`);

    /* -----------------------------------------
       INTENÇÃO: CONTROLE (PLANTA DANINHA)
    ----------------------------------------- */
    if (intent === "controle") {
        if (weed) {
            out.push(ZyCheckWeedControl(prod, weed));
            out.push("<br>" + ZyCheckResistance(prod));
        } else if (pest) {
            out.push(ZyCheckPestControl(prod, pest));
        } else if (disease) {
            out.push(ZyCheckDiseaseControl(prod, disease));
        } else {
            out.push("ℹ️ Para verificar controle, especifique a praga, doença ou planta daninha.");
        }
    }

    /* -----------------------------------------
       INTENÇÃO: DOSE
    ----------------------------------------- */
    else if (intent === "dose") {
        out.push(`Dose recomendada (referencial): <b>${prod.dose_ha || prod.dose || "não disponível"}</b>.`);
        out.push("⚠️ Ajuste dependendo de estágio da planta e condições climáticas.");
    }

    /* -----------------------------------------
       INTENÇÃO: CULTURA (COMPATIBILIDADE)
    ----------------------------------------- */
    else if (intent === "cultura") {
        if (culture) {
            out.push(ZyCheckCultureCompatibility(prod, culture));
            out.push(ZyCheckPhytotoxicity(prod, culture));
        } else {
            out.push("ℹ️ Não identifiquei a cultura especificada.");
        }
    }

    /* -----------------------------------------
       INTENÇÃO: RESISTÊNCIA
    ----------------------------------------- */
    else if (intent === "resistencia") {
        out.push(ZyCheckResistance(prod));
        out.push("<br>Recomendação: rotacionar HRAC/FRAC/IRAC.");
    }

    /* -----------------------------------------
       INTENÇÃO: MISTURA
    ----------------------------------------- */
    else if (intent === "mistura") {
        out.push(ZyMix(prod));
    }

    /* -----------------------------------------
       INTENÇÃO: ABELHAS
    ----------------------------------------- */
    else if (intent === "abelhas") {
        out.push(ZyCheckBeeRisk(prod));
        out.push("<br>⚠️ Evitar aplicação em florescimento.");
    }

    /* -----------------------------------------
       INTENÇÃO: MECANISMO (HRAC/FRAC/IRAC)
    ----------------------------------------- */
    else if (intent === "mecanismo") {
        out.push(ZyGetMechanism(prod));
    }

    /* -----------------------------------------
       INTENÇÃO: MANEJO COMPLETO
    ----------------------------------------- */
    else if (intent === "manejo") {
        out.push(ZyBuildManejo(prod, culture));
    }

    /* -----------------------------------------
       INTENÇÃO: GERAL / FALLBACK
    ----------------------------------------- */
    else {
        out.push("ℹ️ Resultado geral (interpretação ampla):");
        out.push(ZyBuildManejo(prod, culture));
    }

    return out.join("<br>");
}


/* ============================================================
   FUNÇÃO QUE O BOTÃO 'ANALISAR' DO HTML CHAMA
============================================================ */
async function ZyRunIAFromHTML() {
    const pergunta = document.getElementById("prompt").value.trim();
    if (!pergunta) {
        document.getElementById("iaresult").innerHTML = "Digite uma pergunta.";
        return;
    }

    const r = await ZyAnswer(pergunta);
    document.getElementById("iaresult").innerHTML = r;
}


/* ============================================================
   BOTÃO "SUGESTÃO DE MANEJO"
============================================================ */
async function ZyRunSuggestFromHTML() {
    const prod = ZyIA.produto;
    const pergunta = document.getElementById("prompt").value.toLowerCase();
    const culture = ZyExtractCulture(pergunta);

    const r = ZyAutoSuggest(prod, culture);
    document.getElementById("iaresult").innerHTML = r;
}
