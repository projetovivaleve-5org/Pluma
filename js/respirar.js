/**
 * Pluma - Exercício de Respiração 3-4-5
 * Inspire 3s · Segure 4s · Expire 5s (ciclo de 12s)
 */

(function () {
    const FASES = [
        { id: 'inhale', texto: 'Inspire', label: 'Inspire pelo nariz', desc: 'Encha os pulmões devagar', dur: 3 },
        { id: 'hold',   texto: 'Segure',  label: 'Segure o ar',        desc: 'Mantenha o ar com calma',  dur: 4 },
        { id: 'exhale', texto: 'Expire',  label: 'Expire pela boca',   desc: 'Solte o ar lentamente',    dur: 5 }
    ];
    const CICLOS = 5;
    const SEGUNDOS_CICLO = FASES.reduce((t, f) => t + f.dur, 0); // 12
    const CIRCUNFERENCIA = 817;
    const TECNICA = '3-4-5';
    const api = window.VivaLeveAPI;

    const $ = (id) => document.getElementById(id);

    let rodando = false;
    let token = 0;

    document.addEventListener('DOMContentLoaded', () => {
        const startBtn = $('startBtn');
        if (!startBtn) return;
        if (!api.exigirLogin()) return;

        const resetBtn = $('resetBtn');

        startBtn.addEventListener('click', () => (rodando ? parar() : iniciar()));
        resetBtn.addEventListener('click', () => { parar(); iniciar(); });

        const statsReset = $('statsReset');
        if (statsReset) {
            statsReset.addEventListener('click', async () => {
                if (!confirm('Apagar todas as suas sessões de respiração? Isso não pode ser desfeito.')) return;
                try {
                    await api.respiracao.apagarTodas();
                } catch (e) {
                    if (api.tratarSemLogin(e)) return;
                    alert(api.mensagemErro(e, 'Não foi possível apagar as sessões.'));
                }
                atualizarStats();
            });
        }

        atualizarStats();
    });

    // ---------- Fluxo ----------
    async function iniciar() {
        const meuToken = ++token;
        rodando = true;
        setBotao(true);
        $('resetBtn').style.display = 'inline-flex';

        for (let ciclo = 1; ciclo <= CICLOS; ciclo++) {
            resetAnel();
            let decorrido = 0;
            for (const fase of FASES) {
                decorrido += fase.dur;
                const ok = await executarFase(fase, decorrido, ciclo, meuToken);
                if (!ok) return;
            }
        }
        concluir();
    }

    function parar() {
        token++;
        rodando = false;
        setBotao(false);
        $('resetBtn').style.display = 'none';
        resetAnel();
        const circulo = $('breathingCircle');
        circulo.className = 'breathing-circle idle';
        circulo.style.removeProperty('--fase-dur');
        $('breathingText').textContent = 'Pronto?';
        $('breathingTimer').textContent = '';
        $('instructionLabel').textContent = 'Toque para começar';
        $('instructionDesc').textContent = 'Relaxe e concentre-se na sua respiração';
    }

    function executarFase(fase, decorridoFim, ciclo, meuToken) {
        return new Promise((resolve) => {
            const circulo = $('breathingCircle');
            circulo.className = 'breathing-circle ' + fase.id;
            circulo.style.setProperty('--fase-dur', fase.dur + 's');

            $('breathingText').textContent = fase.texto;
            $('instructionLabel').textContent = fase.label;
            $('instructionDesc').textContent = `${fase.desc} · ciclo ${ciclo} de ${CICLOS}`;

            const anel = $('progressRing');
            anel.style.transition = `stroke-dashoffset ${fase.dur}s linear`;
            anel.style.strokeDashoffset = CIRCUNFERENCIA * (1 - decorridoFim / SEGUNDOS_CICLO);

            let restante = fase.dur;
            $('breathingTimer').textContent = restante;
            const intervalo = setInterval(() => {
                if (meuToken !== token) { clearInterval(intervalo); resolve(false); return; }
                restante--;
                if (restante <= 0) {
                    clearInterval(intervalo);
                    resolve(true);
                } else {
                    $('breathingTimer').textContent = restante;
                }
            }, 1000);
        });
    }

    function concluir() {
        rodando = false;
        setBotao(false);
        const circulo = $('breathingCircle');
        circulo.className = 'breathing-circle idle';
        $('breathingText').textContent = 'Muito bem 🌿';
        $('breathingTimer').textContent = '';
        $('instructionLabel').textContent = 'Exercício concluído';
        $('instructionDesc').textContent = `Você fez ${CICLOS} ciclos de respiração 3-4-5`;
        salvarSessao().then(atualizarStats);
    }

    // ---------- UI ----------
    function setBotao(ativo) {
        const btn = $('startBtn');
        btn.querySelector('i').className = ativo ? 'fas fa-stop' : 'fas fa-play';
        btn.setAttribute('aria-label', ativo ? 'Parar' : 'Iniciar');
    }

    function resetAnel() {
        const anel = $('progressRing');
        anel.style.transition = 'none';
        anel.style.strokeDashoffset = CIRCUNFERENCIA;
        void anel.getBoundingClientRect(); // força reflow antes da próxima transição
    }

    // ---------- Sessões (back-end: /v1/breathing) ----------
    async function salvarSessao() {
        try {
            await api.respiracao.registrar({
                technique: TECNICA,
                cycles: CICLOS,
                durationSeconds: CICLOS * SEGUNDOS_CICLO
            });
        } catch (e) {
            if (api.tratarSemLogin(e)) return;
            $('instructionDesc').textContent = 'Exercício concluído, mas a sessão não foi salva: ' + api.mensagemErro(e);
        }
    }

    async function atualizarStats() {
        try {
            const s = await api.respiracao.stats();
            $('todaySessions').textContent = s.todaySessions || 0;
            $('totalSessions').textContent = s.totalSessions || 0;
            $('totalMinutes').textContent = s.totalMinutes || 0;
        } catch (e) {
            api.tratarSemLogin(e);
        }
    }
})();
