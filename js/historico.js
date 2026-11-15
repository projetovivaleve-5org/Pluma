/**
 * Pluma - Histórico de Humor
 * Dados do back-end (precisa de login):
 *   /api/history/summary       cards de registros, sequências e sessões de respiração
 *   /api/history/evolution     gráfico de linha (média do humor por dia)
 *   /api/history/distribution  gráfico de rosca + emoção predominante
 *   /v1/mood-logs/all          lista de registros recentes
 * Gráficos com Chart.js (carregado no historico.html).
 */

const api = window.VivaLeveAPI;

const DIAS_PERIODO = { week: 7, month: 30 };
const RECENTES_INICIAL = 5;

// O back dá nota 0 para ANSIOSO; no gráfico, o eixo vai de 0 a 5.
const ROTULOS_NOTA = { 0: '😰', 1: '😢', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' };

let graficoEvolucao = null;
let graficoEmocoes = null;
let registros = [];
let mostrarTodos = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!api.exigirLogin()) return;
    configurarPeriodo();
    configurarVerTodos();
    carregarTudo();
});

function configurarPeriodo() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            carregarGraficos(DIAS_PERIODO[btn.dataset.period] || 7);
        });
    });
}

function configurarVerTodos() {
    const btn = document.getElementById('viewAllBtn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        mostrarTodos = !mostrarTodos;
        btn.textContent = mostrarTodos ? 'Ver menos' : 'Ver todos';
        renderizarLista();
    });
}

function periodoAtual() {
    const ativo = document.querySelector('.period-btn.active');
    return (ativo && DIAS_PERIODO[ativo.dataset.period]) || 7;
}

async function carregarTudo() {
    try {
        const [resumo, lista, respiracao] = await Promise.all([
            api.historicoEmocional.resumo(),
            api.humor.todos(),
            api.respiracao.stats().catch(() => null)
        ]);
        registros = (lista || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // /api/history/summary ainda devolve 0 sessões de respiração (TODO no back): usa /v1/breathing/stats
        const r = { ...(resumo || {}) };
        if (respiracao) r.breathingSessions = respiracao.totalSessions;
        renderizarResumo(r);

        if (registros.length === 0) {
            mostrarVazio(true);
            return;
        }
        mostrarVazio(false);
        renderizarLista();
        await carregarGraficos(periodoAtual());
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        mostrarErro(api.mensagemErro(e));
    }
}

async function carregarGraficos(dias) {
    try {
        const [evolucao, distribuicao] = await Promise.all([
            api.historicoEmocional.evolucao(dias),
            api.historicoEmocional.distribuicao(dias)
        ]);
        renderizarEvolucao(evolucao || []);
        renderizarDistribuicao(distribuicao || { items: [], total: 0 });
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        mostrarErro(api.mensagemErro(e));
    }
}

// ---------------------------------------------------------------- cards

function texto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function renderizarResumo(r) {
    const atual = r.currentStreak || 0;
    texto('totalRecords', r.totalRecords || 0);
    texto('streakDays', atual);
    texto('bestStreak', r.bestStreak || 0);
    texto('breathingSessions', r.breathingSessions || 0);
    texto('currentStreak', atual);
    texto('streakMessage', atual === 0
        ? 'Registre seu humor hoje para começar uma sequência.'
        : atual === 1 ? 'Bom começo! Volte amanhã.' : 'Continue assim!');
}

// ---------------------------------------------------------------- gráfico de evolução

function renderizarEvolucao(pontos) {
    const canvas = document.getElementById('moodChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (graficoEvolucao) graficoEvolucao.destroy();

    // dias sem registro vêm com averageScore null: ficam fora do gráfico
    const ordenados = pontos
        .filter(p => p.count > 0 && p.averageScore !== null && p.averageScore !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date));
    const labels = ordenados.map(p => {
        const [ano, mes, dia] = p.date.split('-').map(Number);
        return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
    });

    graficoEvolucao = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Humor médio do dia',
                data: ordenados.map(p => Number(p.averageScore.toFixed(2))),
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#8B5CF6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const p = ordenados[ctx.dataIndex];
                            return ` Média ${p.averageScore.toFixed(1)} · ${p.count} registro(s)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 5,
                    ticks: { stepSize: 1, callback: (v) => ROTULOS_NOTA[v] || '' },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ---------------------------------------------------------------- distribuição

function renderizarDistribuicao(dist) {
    const itens = (dist.items || []).filter(i => i.count > 0).sort((a, b) => b.count - a.count);

    // Rosca
    const canvas = document.getElementById('emotionsChart');
    if (canvas && typeof Chart !== 'undefined') {
        if (graficoEmocoes) graficoEmocoes.destroy();
        const dados = itens.map(i => Pluma.getEmotionData(api.emocao.daApi(i.mood)));
        graficoEmocoes = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: dados.map(d => `${d.icon} ${d.label}`),
                datasets: [{
                    data: itens.map(i => i.count),
                    backgroundColor: dados.map(d => d.color),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Emoção predominante
    if (dist.predominant) {
        const d = Pluma.getEmotionData(api.emocao.daApi(dist.predominant));
        texto('dominantIcon', d.icon);
        texto('dominantLabel', d.label);
        texto('dominantPercent', `${Math.round(dist.predominantPercentage || 0)}% dos registros`);
    } else {
        texto('dominantIcon', '😶');
        texto('dominantLabel', 'Sem registros no período');
        texto('dominantPercent', '');
    }

    // Barras por emoção
    const breakdown = document.getElementById('emotionsBreakdown');
    if (breakdown) {
        breakdown.innerHTML = itens.map(i => {
            const id = api.emocao.daApi(i.mood);
            const d = Pluma.getEmotionData(id);
            const pct = Math.round(i.percentage || 0);
            return `
                <div class="emotion-bar">
                    <span class="emotion-bar-icon">${d.icon}</span>
                    <div class="emotion-bar-info">
                        <div class="emotion-bar-label">
                            <span class="emotion-bar-name">${d.label}</span>
                            <span class="emotion-bar-percent">${pct}%</span>
                        </div>
                        <div class="emotion-bar-progress">
                            <div class="emotion-bar-fill ${id}" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ---------------------------------------------------------------- lista de registros

function renderizarLista() {
    const container = document.getElementById('historyItems');
    if (!container) return;

    const visiveis = mostrarTodos ? registros : registros.slice(0, RECENTES_INICIAL);
    const btn = document.getElementById('viewAllBtn');
    if (btn) btn.style.display = registros.length > RECENTES_INICIAL ? '' : 'none';

    container.innerHTML = visiveis.map(r => {
        const d = Pluma.getEmotionData(api.emocao.daApi(r.mood));
        const data = new Date(r.createdAt);
        const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="history-item">
                <div class="history-item-date">
                    <div class="history-item-day">${data.getDate()}</div>
                    <div class="history-item-month">${Pluma.getMonthName(data)}</div>
                </div>
                <span class="history-item-emotion">${d.icon}</span>
                <div class="history-item-info">
                    <div class="history-item-label">${d.label} · ${hora}</div>
                    ${r.note ? `<div class="history-item-note">${Pluma.escapeHtml(r.note)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ---------------------------------------------------------------- estados

function mostrarVazio(vazio) {
    const empty = document.getElementById('historyEmpty');
    if (empty) empty.style.display = vazio ? '' : 'none';
    document.querySelectorAll('.charts-section, .dominant-emotion, .history-list').forEach(el => {
        el.style.display = vazio ? 'none' : '';
    });
}

function mostrarErro(mensagem) {
    const container = document.getElementById('historyItems');
    if (container) {
        container.innerHTML = `<p class="history-item-note">${Pluma.escapeHtml(mensagem)}</p>`;
    }
}
