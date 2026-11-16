/**
 * VivaLeve / Pluma - Comunicação com a API (back-end Spring Boot)
 *
 * - Guarda o token (JWT) do login e manda "Authorization: Bearer <token>" em toda chamada.
 * - Nunca manda userId: o back pega o usuário pelo token.
 * - Módulos (window.VivaLeveAPI.*):
 *     auth               /v1/auth/*                 login, cadastro, Google
 *     usuarios           /v1/users/me               usuário logado
 *     estatisticas       /v1/stats                  resumo, sequência, evolução e distribuição
 *     humor              /v1/mood-logs              registro de humor (OTIMO..ANSIOSO + atividades)
 *     diario             /v1/diary                  diário
 *     respiracao         /v1/breathing/*            sessões e estatísticas de respiração
 *     historicoEmocional /api/history/*             gráficos do histórico emocional
 *     ia                 /v1/ai/*                   chat da Pluma, insights e reflexões
 *
 * URL da API:
 *  - Abrindo o front em localhost / 127.0.0.1: http://localhost:8080
 *  - Em produção: PRODUCAO_URL abaixo
 *  - Para testar outra URL sem mexer no código, abra qualquer página com
 *      ?api=http://localhost:8081
 *    (fica salvo no localStorage em "pluma_api_url"; para voltar ao padrão: ?api=padrao)
 */

(function () {
    // URL pública do back-end (Render).
    const PRODUCAO_URL = "https://back-end-vivaleve.onrender.com";
    const LOCAL_URL = "http://localhost:8080";

    // Client ID "Web application" do Google Cloud Console: o MESMO valor do GOOGLE_CLIENT_ID do back-end.
    // Não é segredo (vai no HTML de qualquer site com login Google). Em "Authorized JavaScript origins"
    // do Console precisam estar as URLs do front (ex.: https://projetopluma.vercel.app e http://localhost:5500).
    // Para testar sem mexer no código: localStorage.setItem("pluma_google_client_id", "...")
    const GOOGLE_CLIENT_ID = "1085961204416-v75mbqjm8k2hhgrtapndf1lm1ame0qb1.apps.googleusercontent.com";

    // O Render grátis "dorme": a primeira chamada pode levar perto de 1 minuto para acordar o back.
    // A IA ainda pode levar até 30s depois disso, então damos folga antes de desistir.
    const TIMEOUT_MS = 70000;

    const KEYS = {
        API_URL: "pluma_api_url",
        TOKEN: "pluma_token",
        TOKEN_EXPIRES: "pluma_token_expires",
        USER: "pluma_user",
        USER_NAME: "pluma_user_name",
        LOGGED_IN: "pluma_logged_in",
        CONVERSA_PREFIXO: "pluma_chat_conversa_"
    };

    // Valores aceitos pelo back.
    const ENUMS = {
        // atividades do /v1/mood-logs
        ATIVIDADES: ["EXERCISE", "WORK", "STUDY", "READING", "FAMILY", "FRIENDS", "HOBBY", "REST", "SLEEP_WELL", "MEDITATION"],
        // /v1/mood-logs, /v1/diary (emotion) e /api/history
        HUMOR: ["OTIMO", "BEM", "MAIS_OU_MENOS", "MAL", "DEPRESSIVO", "ANSIOSO"]
    };

    // ?api=... na URL troca a API (útil para testar local em outra porta)
    const apiDaUrl = new URLSearchParams(window.location.search).get("api");
    if (apiDaUrl === "padrao") localStorage.removeItem(KEYS.API_URL);
    else if (apiDaUrl) localStorage.setItem(KEYS.API_URL, apiDaUrl);

    function baseUrl() {
        const override = localStorage.getItem(KEYS.API_URL);
        if (override) return override.replace(/\/$/, "");
        const local = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
        return local ? LOCAL_URL : PRODUCAO_URL;
    }

    // ------------------------------------------------------------ sessão

    function usuario() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.USER) || "{}");
        } catch {
            return {};
        }
    }

    /** Guarda o usuário no navegador e devolve o nome a exibir. */
    function guardarUsuario(u) {
        u = u || {};
        const nome = u.name || (u.email ? u.email.split("@")[0] : "");
        localStorage.setItem(KEYS.USER, JSON.stringify({
            id: u.id,
            email: u.email,
            name: nome,
            pictureUrl: u.pictureUrl || null
        }));
        localStorage.setItem(KEYS.USER_NAME, nome);
        return nome;
    }

    /** Apaga o token. Os botões "Sair" das páginas só tiram o pluma_logged_in, então token() também chama isto. */
    function limparToken() {
        localStorage.removeItem(KEYS.TOKEN);
        localStorage.removeItem(KEYS.TOKEN_EXPIRES);
    }

    /** Token válido do usuário logado, ou null. */
    function token() {
        const t = localStorage.getItem(KEYS.TOKEN);
        if (!t) return null;
        const saiu = localStorage.getItem(KEYS.LOGGED_IN) !== "true";
        const expira = Date.parse(localStorage.getItem(KEYS.TOKEN_EXPIRES) || "");
        const expirou = !Number.isNaN(expira) && expira <= Date.now();
        if (saiu || expirou) {
            limparToken();
            return null;
        }
        return t;
    }

    /** Salva a resposta de /v1/auth/login, /register ou /google: { token, tokenType, expiresAt, user }. */
    function salvarSessao(auth) {
        localStorage.setItem(KEYS.TOKEN, auth.token);
        if (auth.expiresAt) localStorage.setItem(KEYS.TOKEN_EXPIRES, auth.expiresAt);
        guardarUsuario(auth.user);
        localStorage.setItem(KEYS.LOGGED_IN, "true");
    }

    // ------------------------------------------------------------ HTTP

    async function request(endpoint, options = {}) {
        const { semToken, ...fetchOptions } = options;
        const headers = { ...(fetchOptions.headers || {}) };
        if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }
        const t = token();
        if (t && !semToken) headers["Authorization"] = "Bearer " + t;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response;
        try {
            response = await fetch(baseUrl() + endpoint, {
                ...fetchOptions,
                headers,
                signal: controller.signal
            });
        } catch (e) {
            const motivo = e.name === "AbortError" ? "não respondeu a tempo" : "não está acessível";
            const err = new Error(`A API em ${baseUrl()} ${motivo}`);
            err.offline = true;
            console.error("[VivaLeve API]", err.message);
            throw err;
        } finally {
            clearTimeout(timer);
        }

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!response.ok) {
            const err = new Error((data && data.message) || `Erro HTTP ${response.status}`);
            err.status = response.status;
            // Token ausente, inválido ou vencido: a pessoa precisa entrar de novo.
            if (response.status === 401 && !semToken) {
                limparToken();
                err.semLogin = true;
            }
            // 404 também vale para registro/diário/conversa de OUTRO usuário (o back responde como se não existisse).
            console.error("[VivaLeve API]", endpoint, err.message);
            throw err;
        }
        return data;
    }

    // ------------------------------------------------------------ helpers

    const http = {
        get: (url) => request(url, { method: "GET" }),
        post: (url, body) => request(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
        put: (url, body) => request(url, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
        delete: (url) => request(url, { method: "DELETE" })
    };

    /** Monta "?a=1&b=2" ignorando valores vazios (undefined, null, ""). Já codifica caracteres especiais. */
    function qs(params = {}) {
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") p.append(k, v);
        });
        const s = p.toString();
        return s ? "?" + s : "";
    }

    /** Data local no formato AAAA-MM-DD (toISOString usa UTC e pode virar o dia errado à noite no Brasil). */
    function dataLocal(d = new Date()) {
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    /** Falha rápido, com mensagem clara, se o valor não for um dos aceitos pelo back. */
    function exigirEnum(valor, lista, campo) {
        if (!lista.includes(valor)) {
            throw new Error(`${campo} inválido: "${valor}". Use um destes: ${lista.join(", ")}`);
        }
    }

    function exigir(valor, campo) {
        if (valor === undefined || valor === null || String(valor).trim() === "") {
            throw new Error(`${campo} é obrigatório`);
        }
    }

    // ------------------------------------------------------------ login (/v1/auth)

    const auth = {
        /** Login com email e senha. Erro 401 = email ou senha inválidos. */
        async login(email, password) {
            const resp = await request("/v1/auth/login", {
                method: "POST",
                semToken: true,
                body: JSON.stringify({ email, password })
            });
            salvarSessao(resp);
            return resp.user;
        },

        /** Cadastro com email e senha (8 a 64 caracteres). Já entra logado. Erro 409 = email já cadastrado. */
        async register(email, password, name) {
            const resp = await request("/v1/auth/register", {
                method: "POST",
                semToken: true,
                body: JSON.stringify({ email, password, name: name || null })
            });
            salvarSessao(resp);
            return resp.user;
        },

        /** Login com o ID Token do botão "Entrar com Google" (Google Identity Services). */
        async google(credential) {
            const resp = await request("/v1/auth/google", {
                method: "POST",
                semToken: true,
                body: JSON.stringify({ credential })
            });
            salvarSessao(resp);
            return resp.user;
        },

        logado() {
            return token() !== null;
        },

        sair() {
            limparToken();
            localStorage.removeItem(KEYS.LOGGED_IN);
            localStorage.removeItem(KEYS.USER);
        }
    };

    // ------------------------------------------------------------ usuário (/v1/users)

    const usuarios = {
        /** Dados do usuário logado: { id, email, name, pictureUrl }. Também atualiza o cache local. */
        async eu() {
            const u = await http.get("/v1/users/me");
            if (u) guardarUsuario(u);
            return u;
        }
    };

    // ------------------------------------------------------------ estatísticas (/v1/stats)

    const estatisticas = {
        /**
         * Resumo dos últimos N dias: { days, startDate, endDate, totalEntries, predominantMood,
         * currentStreak, longestStreak, evolution[], distribution[] }.
         */
        resumo(days) {
            return http.get("/v1/stats" + qs({ days }));
        }
    };

    // ------------------------------------------------------------ registro rápido de humor (/v1/mood-logs)

    // ATENÇÃO: no POST/PUT o back só aceita multipart/form-data (o campo opcional "image" é um arquivo),
    // então mood, note e activities vão num FormData, e não em JSON. O mood é OTIMO|BEM|...
    // activities: uma entrada "activities" por atividade. No PUT, activities = null mantém as atuais.
    function formHumor(mood, note, activities) {
        const form = new FormData();
        form.append("mood", mood);
        if (note) form.append("note", note);
        if (activities) {
            activities.forEach((a) => {
                exigirEnum(a, ENUMS.ATIVIDADES, "activities");
                form.append("activities", a);
            });
        }
        return form;
    }

    const humor = {
        /** Lista paginada: { content[], totalPages, totalElements, number, size, first, last, empty... }. */
        listar({ page = 0, size = 20, sort } = {}) {
            return http.get("/v1/mood-logs" + qs({ page, size, sort }));
        },

        /** Todos os registros, sem paginar. */
        todos() {
            return http.get("/v1/mood-logs/all");
        },

        /** Registros de hoje (lista). */
        hoje() {
            return http.get("/v1/mood-logs/today");
        },

        /** activities: lista de ENUMS.ATIVIDADES (opcional). A resposta inclui activities. */
        criar(mood, note, activities = []) {
            exigirEnum(mood, ENUMS.HUMOR, "mood");
            return request("/v1/mood-logs", { method: "POST", body: formHumor(mood, note, activities) });
        },

        /** activities = null (padrão) mantém as atividades já salvas; [] apaga todas. */
        atualizar(id, mood, note, activities = null) {
            exigirEnum(mood, ENUMS.HUMOR, "mood");
            return request(`/v1/mood-logs/${id}`, { method: "PUT", body: formHumor(mood, note, activities) });
        },

        apagar(id) {
            return http.delete(`/v1/mood-logs/${id}`);
        }
    };

    // ------------------------------------------------------------ diário (/v1/diary)

    const diario = {
        /** Lista os textos do diário. q (opcional) filtra por busca. */
        listar(q) {
            return http.get("/v1/diary" + qs({ q }));
        },

        /** title e text obrigatórios; emotion opcional (ENUMS.HUMOR). */
        criar({ title, text, emotion } = {}) {
            exigir(title, "title");
            exigir(text, "text");
            if (emotion) exigirEnum(emotion, ENUMS.HUMOR, "emotion");
            return http.post("/v1/diary", { title, text, emotion: emotion || null });
        },

        buscar(id) {
            return http.get(`/v1/diary/${id}`);
        },

        atualizar(id, { title, text, emotion } = {}) {
            exigir(title, "title");
            exigir(text, "text");
            if (emotion) exigirEnum(emotion, ENUMS.HUMOR, "emotion");
            return http.put(`/v1/diary/${id}`, { title, text, emotion: emotion || null });
        },

        apagar(id) {
            return http.delete(`/v1/diary/${id}`);
        }
    };

    // ------------------------------------------------------------ respiração (/v1/breathing)

    const respiracao = {
        /** Sessões do usuário: [{ id, technique, cycles, durationSeconds, sessionDate, createdAt }]. */
        sessoes() {
            return http.get("/v1/breathing/sessions");
        },

        /** Registra uma sessão concluída. Todos os campos são obrigatórios. */
        registrar({ technique, cycles, durationSeconds } = {}) {
            exigir(technique, "technique");
            exigir(cycles, "cycles");
            exigir(durationSeconds, "durationSeconds");
            return http.post("/v1/breathing/sessions", {
                technique,
                cycles: Number(cycles),
                durationSeconds: Number(durationSeconds)
            });
        },

        /** CUIDADO: o endpoint não recebe id, então apaga as sessões do usuário (peça confirmação na tela). */
        apagarTodas() {
            return http.delete("/v1/breathing/sessions");
        },

        /** { todaySessions, totalSessions, totalMinutes }. */
        stats() {
            return http.get("/v1/breathing/stats");
        }
    };

    // ------------------------------------------------------------ histórico emocional (/api/history)
    // ATENÇÃO: este grupo usa o prefixo /api, e não /v1.

    const historicoEmocional = {
        /** { items[], total, predominant, predominantPercentage } dos últimos N dias. */
        distribuicao(days) {
            return http.get("/api/history/distribution" + qs({ days }));
        },

        /** [{ date, averageScore, count }] dos últimos N dias (para o gráfico de linha). */
        evolucao(days) {
            return http.get("/api/history/evolution" + qs({ days }));
        },

        /** { totalRecords, currentStreak, bestStreak, breathingSessions }. */
        resumo() {
            return http.get("/api/history/summary");
        }
    };

    // ------------------------------------------------------------ IA (/v1/ai)

    /** A conversa do chat é guardada por usuário, para não misturar contas no mesmo navegador. */
    function chaveConversa() {
        return KEYS.CONVERSA_PREFIXO + (usuario().id || "anon");
    }

    function nomeParaIa() {
        const nome = usuario().name || localStorage.getItem(KEYS.USER_NAME) || "";
        return nome ? nome.slice(0, 60) : null;
    }

    /**
     * Toda resposta da IA vem no mesmo formato:
     * { conversationId, messageId, useCase, status, reply, crisisDetected, helpResources, model, createdAt }
     * status: SUCCESS (resposta da IA) | FALLBACK (IA fora, texto padrão) | CRISIS (risco: mostrar CVV 188)
     */
    const ia = {
        /** Envia uma mensagem para a Pluma. Continua a conversa salva, se houver. */
        async conversar(mensagem) {
            const salva = localStorage.getItem(chaveConversa());
            const body = {
                conversationId: salva ? Number(salva) : null,
                message: mensagem,
                userName: nomeParaIa()
            };
            try {
                const resp = await request("/v1/ai/chat", { method: "POST", body: JSON.stringify(body) });
                localStorage.setItem(chaveConversa(), resp.conversationId);
                return resp;
            } catch (e) {
                // conversa apagada: começa uma nova e tenta de novo uma vez
                if (e.status === 404 && body.conversationId) {
                    localStorage.removeItem(chaveConversa());
                    return ia.conversar(mensagem);
                }
                throw e;
            }
        },

        /** Mensagens da conversa salva, em ordem ([] se não houver). Cada uma: { id, role, content, status, createdAt }. */
        async historico() {
            const salva = localStorage.getItem(chaveConversa());
            if (!salva) return [];
            try {
                return await request(`/v1/ai/conversations/${salva}/messages`, { method: "GET" });
            } catch (e) {
                if (e.status === 404) {
                    localStorage.removeItem(chaveConversa());
                    return [];
                }
                throw e;
            }
        },

        /** Apaga a conversa atual no back (se houver); a próxima mensagem abre outra. */
        async novaConversa() {
            const salva = localStorage.getItem(chaveConversa());
            localStorage.removeItem(chaveConversa());
            if (salva) {
                try {
                    await request(`/v1/ai/conversations/${salva}`, { method: "DELETE" });
                } catch (e) {
                    if (e.status !== 404) throw e;
                }
            }
        },

        /** Lista as conversas do usuário (mais recente primeiro): [{ id, useCase, title, createdAt, lastMessageAt }]. */
        conversas() {
            return request("/v1/ai/conversations", { method: "GET" });
        },

        /** Mensagens de uma conversa específica (para uma tela de histórico de conversas). */
        mensagens(conversationId) {
            return http.get(`/v1/ai/conversations/${conversationId}/messages`);
        },

        /** Apaga uma conversa específica pelo id. */
        apagarConversa(conversationId) {
            return http.delete(`/v1/ai/conversations/${conversationId}`);
        },

        /** Texto curto sobre as estatísticas de humor de 7 ou 30 dias (usa os registros salvos no back). */
        insightHumor(days = 7) {
            return request("/v1/ai/insights/mood", {
                method: "POST",
                body: JSON.stringify({ days, userName: nomeParaIa() })
            });
        },

        /** Comentário acolhedor sobre um registro de humor salvo no back (id do /v1/mood-logs). */
        reflexaoRegistro(moodLogId) {
            return request(`/v1/ai/mood-logs/${moodLogId}/reflection`, {
                method: "POST",
                body: JSON.stringify({ userName: nomeParaIa() })
            });
        }
    };

    // ------------------------------------------------------------ ajudas para as telas

    /**
     * As telas usam ids em minúsculo com hífen ("mais-ou-menos"); o back usa OTIMO, MAIS_OU_MENOS...
     * paraApi("mais-ou-menos") -> "MAIS_OU_MENOS" · daApi("MAIS_OU_MENOS") -> "mais-ou-menos"
     */
    const emocao = {
        paraApi(id) {
            return id ? String(id).toUpperCase().replace(/-/g, "_") : null;
        },
        daApi(valor) {
            return valor ? String(valor).toLowerCase().replace(/_/g, "-") : null;
        }
    };

    /** Atividades da tela (data-activity) -> ENUMS.ATIVIDADES. */
    const ATIVIDADE_PARA_API = {
        "trabalho": "WORK",
        "exercicio": "EXERCISE",
        "familia": "FAMILY",
        "amigos": "FRIENDS",
        "hobby": "HOBBY",
        "descanso": "REST",
        "estudo": "STUDY",
        "meditacao": "MEDITATION",
        "leitura": "READING",
        "sono": "SLEEP_WELL"
    };

    /** Manda para o login se não houver token válido. Use no começo de cada tela protegida. */
    function exigirLogin() {
        if (token() === null) {
            window.location.href = "login.html";
            return false;
        }
        return true;
    }

    /** Mensagem amigável para mostrar na tela a partir de um erro do request(). */
    function mensagemErro(e, padrao = "Não foi possível falar com o servidor. Tente de novo.") {
        if (!e) return padrao;
        if (e.semLogin) return "Sua sessão expirou. Entre de novo.";
        if (e.offline) return "O servidor não respondeu. Ele pode estar acordando: tente de novo em alguns segundos.";
        return e.message || padrao;
    }

    /** Se o erro for de sessão (401), leva para o login. Devolve true quando redirecionou. */
    function tratarSemLogin(e) {
        if (e && e.semLogin) {
            window.location.href = "login.html";
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------ API pública

    window.VivaLeveAPI = {
        get baseURL() {
            return baseUrl();
        },
        get googleClientId() {
            return localStorage.getItem("pluma_google_client_id") || GOOGLE_CLIENT_ID;
        },
        request,
        auth,
        usuarios,
        estatisticas,
        humor,
        diario,
        respiracao,
        historicoEmocional,
        ia,
        usuario,
        ENUMS,
        dataLocal,
        emocao,
        ATIVIDADE_PARA_API,
        exigirLogin,
        mensagemErro,
        tratarSemLogin,

        get(endpoint) {
            return request(endpoint, { method: "GET" });
        },
        post(endpoint, body) {
            return request(endpoint, { method: "POST", body: JSON.stringify(body) });
        },
        put(endpoint, body) {
            return request(endpoint, { method: "PUT", body: JSON.stringify(body) });
        },
        delete(endpoint) {
            return request(endpoint, { method: "DELETE" });
        }
    };
})();