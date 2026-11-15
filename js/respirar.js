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
    const KEY_SESSOES = 'pluma_respiracao_sessoes';

    const $ = (id) => document.getElementById(id);

    let rodando = false;
    let token = 0;

    document.addEventListener('DOMContentLoaded', () => {
        const startBtn = $('startBtn');
        if (!startBtn) return;

        const resetBtn = $('resetBtn');

        startBtn.addEventListener('click', () => (rodando ? parar() : iniciar()));
        resetBtn.addEventListener('click', () => { parar(); iniciar(); });

        const statsReset = $('statsReset');
        if (statsReset) {
            statsReset.addEventListener('click', () => {
                if (confirm('Limpar o histórico de sessões de respiração?')) {
                    localStorage.removeItem(KEY_SESSOES);
                    atualizarStats();
                }
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
        salvarSessao();
        atualizarStats();
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

    // ---------- Sessões ----------
    function lerSessoes() {
        try { return JSON.parse(localStorage.getItem(KEY_SESSOES) || '[]'); }
        catch (e) { return []; }
    }

    function salvarSessao() {
        const sessoes = lerSessoes();
        sessoes.push({
            id: Date.now().toString(),
            tecnica: '3-4-5',
            nome: 'Técnica 3-4-5',
            data: new Date().toISOString(),
            ciclos: CICLOS,
            segundos: CICLOS * SEGUNDOS_CICLO
        });
        localStorage.setItem(KEY_SESSOES, JSON.stringify(sessoes));
    }

    function atualizarStats() {
        const sessoes = lerSessoes();
        const hoje = new Date().toDateString();
        const hojeQtd = sessoes.filter((s) => new Date(s.data).toDateString() === hoje).length;
        const segundos = sessoes.reduce((t, s) => t + (s.segundos || (s.ciclos || 0) * SEGUNDOS_CICLO), 0);
        $('todaySessions').textContent = hojeQtd;
        $('totalSessions').textContent = sessoes.length;
        $('totalMinutes').textContent = Math.round(segundos / 60);
    }
})();
