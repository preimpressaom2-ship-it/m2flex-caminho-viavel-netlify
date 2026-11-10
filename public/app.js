(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const STATUS = ['Planejado', 'Em andamento', 'Concluído', 'Bloqueado', 'Reprogramado'];
  const PH = ['var(--c)', 'var(--m)', 'var(--y)', 'var(--k)'];
  const POLL_MS = 20000;

  const SCHEMA = {
    cronograma: { nome: 'Cronograma', ordenar: 'data', cols: [
      ['data', 'Data', 'date'], ['fase', 'Fase', 'fase'], ['frente', 'Frente', 'text'], ['titulo', 'Título da etapa', 'text', 'w'],
      ['atividade', 'Atividade', 'long'], ['responsavel', 'Responsável sugerido', 'text', 'w'], ['status', 'Status', ['', ...STATUS]],
      ['espectro', 'Usa o espectro?', ['Sim', 'Não']], ['entregavel', 'Entregável sugerido', 'long'], ['criterio', 'Critério sugerido (a validar)', 'long'],
      ['atencao', 'Dependência / ponto de atenção', 'long'], ['comentario', 'Comentário da gestão', 'long']] },
    conjuntos: { nome: 'Conjuntos', cols: [
      ['conjunto', 'Conjunto', 'text', 'w'], ['processo', 'Processo', 'long'], ['prioridade', 'Prioridade proposta', ['1', '2', '3']],
      ['classificacao', 'Classificação sugerida (13/11)', ['Pendente', 'A – perfil atual aprovado', 'B – relinearizar', 'C – perfil novo']],
      ['homologacao', 'Status de homologação', ['Não iniciado', 'Em linearização', 'Em caracterização', 'Em validação', 'Homologado', 'Homologado com restrição', 'Reprovado / contingência']],
      ['rip', 'RIP e versão', 'text', 'w'], ['tinta', 'Tinta', 'text', 'w'], ['substrato', 'Substrato da campanha', 'text', 'w'], ['perfil', 'Perfil atual', 'text', 'w'],
      ['instrumento', 'Instrumento / condição de medição', 'text', 'w'], ['observacoes', 'Observações técnicas', 'long']] },
    riscos: { nome: 'Riscos', cols: [
      ['codigo', 'ID', 'text', 'n'], ['risco', 'Risco', 'long'], ['impacto', 'Impacto', ['Alto', 'Médio', 'Baixo']], ['probabilidade', 'Probabilidade', ['Certa', 'Alta', 'Média', 'Baixa']],
      ['mitigacao', 'Mitigação sugerida', 'long'], ['alternativa', 'Alternativa sugerida', 'long'], ['responsavel', 'Responsável sugerido', 'text', 'w']] },
    pendencias: { nome: 'Pendências', cols: [
      ['pergunta', 'Pergunta', 'long'], ['paraQuem', 'Para quem', 'text', 'w'], ['prazo', 'Prazo', 'date'], ['resposta', 'Resposta', 'long']] },
    papeis: { nome: 'Papéis', cols: [
      ['papel', 'Papel', 'text', 'w'], ['nome', 'Nome', 'text', 'w'], ['atribuicoes', 'Atribuições sugeridas', 'long'], ['autonomia', 'Autonomia sugerida', 'long']] },
  };

  const S = {
    dados: null, etag: null, base: null, editavel: true, local: false,
    editando: false, senha: sessionStorage.getItem('m2-senha') || '', autor: localStorage.getItem('m2-autor') || '',
    aba: 'painel', tabela: 'cronograma', sel: null, filtro: { fase: '', frente: '', status: '', spec: false },
    salvando: false, remoto: null, ultimaSync: null, conflito: null, animou: false,
  };
  const sujo = () => S.dados && JSON.stringify(S.dados) !== S.base;

  // ---------- utilidades ----------
  const partes = (s) => String(s || '').slice(0, 10).split('-').map(Number);
  const fmt = (s) => { const [y, m, d] = partes(s); return y ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` : '—'; };
  const fmtL = (s) => { const [y, m, d] = partes(s); return y ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : '—'; };
  const diaSem = (s) => { const [y, m, d] = partes(s); return y ? DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : ''; };
  const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
  const nota = (r) => /^(Feriado|Folga)$/i.test(r.frente || '');
  const corSt = (s) => ({ 'Concluído': 'var(--ok)', 'Bloqueado': 'var(--bad)', 'Reprogramado': 'var(--warn)', 'Em andamento': 'var(--c)' }[s] || 'var(--muted)');
  const fasesDe = (rows) => Array.from(new Set(rows.map((r) => r.fase).filter(Boolean))).sort();
  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));
  function diasUteis(ini, fim, feriados) {
    const [a, b, c] = partes(ini), [x, y, z] = partes(fim); if (!a || !x) return '—';
    const fer = new Set(String(feriados || '').split(/[,;\s]+/).filter(Boolean));
    let n = 0; const d = new Date(Date.UTC(a, b - 1, c)), f = new Date(Date.UTC(x, y - 1, z));
    while (d <= f) { const dw = d.getUTCDay(), iso = d.toISOString().slice(0, 10); if (dw && dw < 6 && !fer.has(iso)) n++; d.setUTCDate(d.getUTCDate() + 1); }
    return n;
  }
  let tt; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3500); }

  // ---------- servidor ----------
  async function carregar(silencioso) {
    let j;
    try {
      const r = await fetch('/api/dados', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      j = await r.json();
    } catch (e) {
      if (!S.dados) {
        const r = await fetch('dados-iniciais.json').catch(() => null);
        const d = r && r.ok ? await r.json() : null;
        if (d) { S.local = true; aplicar({ dados: d, etag: null, editavel: false }); }
        setSync('bad', 'Sem conexão com o servidor – exibindo a versão inicial (somente leitura)');
      } else setSync('bad', 'Sem conexão – tentando novamente');
      return;
    }
    S.editavel = j.editavel !== false;
    S.ultimaSync = new Date();
    if (S.etag && j.etag === S.etag) { atualizarSync(); return; }
    if (S.etag && sujo()) {
      S.remoto = j;
      mostrarAviso(`${j.dados.atualizadoPor || 'Outra pessoa'} salvou alterações em ${hora(j.dados.atualizadoEm)}. Salve ou descarte as suas para ver a versão nova.`);
      atualizarSync(); return;
    }
    const outro = !!S.etag;
    aplicar(j);
    if (outro && silencioso) toast(`Atualizado com alterações de ${j.dados.atualizadoPor || 'outra pessoa'}`);
  }
  function aplicar(j) {
    S.dados = j.dados; S.etag = j.etag; S.base = JSON.stringify(j.dados); S.remoto = null;
    esconderAviso(); renderTudo(); atualizarSync();
  }
  function resumoAlteracoes(antes, depois) {
    const partesTxt = [];
    for (const t of Object.keys(SCHEMA)) {
      const a = new Map((antes[t] || []).map((r) => [r.id, JSON.stringify(r)])), b = depois[t] || [];
      let alt = 0, nov = 0; const ids = new Set();
      b.forEach((r) => { ids.add(r.id); if (!a.has(r.id)) nov++; else if (a.get(r.id) !== JSON.stringify(r)) alt++; });
      const rem = [...a.keys()].filter((id) => !ids.has(id)).length;
      const p = []; if (alt) p.push(`${alt} alterada${alt > 1 ? 's' : ''}`); if (nov) p.push(`${nov} nova${nov > 1 ? 's' : ''}`); if (rem) p.push(`${rem} removida${rem > 1 ? 's' : ''}`);
      if (p.length) partesTxt.push(`${SCHEMA[t].nome}: ${p.join(', ')}`);
    }
    if (JSON.stringify(antes.resumo) !== JSON.stringify(depois.resumo)) partesTxt.push('Prazo atualizado');
    return partesTxt.join('; ') || 'Sem mudanças de conteúdo';
  }
  async function salvar(rapido) {
    if (!sujo()) return;
    if (S.salvando) { S.filaSalvar = true; return; }
    S.salvando = true; $('b-salvar').disabled = true; $('b-salvar').textContent = 'Salvando…';
    const enviado = JSON.stringify(S.dados);
    try {
      const r = await fetch('/api/dados', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-senha': S.senha },
        body: JSON.stringify({ dados: S.dados, etag: S.etag, autor: S.autor, resumo: resumoAlteracoes(JSON.parse(S.base), S.dados) }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { S.senha = ''; sessionStorage.removeItem('m2-senha'); toast('A senha não confere mais. Entre novamente para salvar.'); abrirSenha(); return; }
      if (r.status === 409) { S.conflito = j; $('conf-txt').textContent = `${j.dados?.atualizadoPor || 'Outra pessoa'} salvou uma versão em ${hora(j.dados?.atualizadoEm)} enquanto você editava.`; $('dlg-conflito').showModal(); return; }
      if (!r.ok) { toast(j.erro || 'Não foi possível salvar.'); return; }
      if (JSON.stringify(S.dados) !== enviado) {
        // houve novas mudanças enquanto salvava: mantém as locais e atualiza só a versão
        S.etag = j.etag; S.base = JSON.stringify(j.dados);
        ['versao', 'atualizadoEm', 'atualizadoPor', 'historico'].forEach((k) => { S.dados[k] = j.dados[k]; });
        S.filaSalvar = true; atualizarSync();
      } else if (rapido) {
        S.dados = j.dados; S.etag = j.etag; S.base = JSON.stringify(j.dados); S.remoto = null; esconderAviso(); atualizarSync();
        $('foot').textContent = rodape();
        if (S.aba !== 'painel') renderTudo();
      } else { aplicar(j); toast('Alterações salvas'); }
    } catch { toast('Sem conexão. Suas alterações continuam na tela; tente salvar de novo.'); }
    finally {
      S.salvando = false; $('b-salvar').disabled = false; $('b-salvar').textContent = 'Salvar alterações'; atualizarBarra();
      if (S.filaSalvar) { S.filaSalvar = false; if (sujo()) salvar(true); }
    }
  }
  $('c-recarregar').addEventListener('click', () => { $('dlg-conflito').close(); aplicar(S.conflito); toast('Versão mais recente carregada'); });
  function mesclar(base, meu, remoto) {
    const out = JSON.parse(JSON.stringify(remoto));
    for (const t of Object.keys(SCHEMA)) {
      const b = new Map((base[t] || []).map((r) => [r.id, JSON.stringify(r)])), mine = new Map((meu[t] || []).map((r) => [r.id, r]));
      let lista = out[t] || [];
      lista = lista.filter((r) => !(b.has(r.id) && !mine.has(r.id)));          // removidas por mim
      for (const r of meu[t] || []) {
        if (b.get(r.id) === JSON.stringify(r)) continue;                          // não mexi
        const i = lista.findIndex((x) => x.id === r.id);
        if (i >= 0) lista[i] = r; else lista.push(r);                             // alteradas ou novas
      }
      out[t] = lista;
    }
    if (JSON.stringify(base.resumo) !== JSON.stringify(meu.resumo)) out.resumo = meu.resumo;
    return out;
  }
  $('c-sobrescrever').addEventListener('click', () => {
    $('dlg-conflito').close();
    const base = JSON.parse(S.base), meu = S.dados, rem = S.conflito;
    S.dados = mesclar(base, meu, rem.dados); S.etag = rem.etag; S.base = JSON.stringify(rem.dados);
    renderTudo(); salvar();
  });

  // ---------- estado de sincronização ----------
  function setSync(c, txt) { $('sync-dot').className = 'dot ' + c; $('sync-txt').textContent = txt; }
  function atualizarSync() {
    if (S.local) return;
    const d = S.dados;
    if (S.remoto) setSync('warn', 'Há uma versão mais nova no servidor');
    else setSync('ok', `Versão ${d.versao} · ${d.atualizadoPor || ''}${d.atualizadoEm ? ' em ' + hora(d.atualizadoEm) : ''}`);
    $('btn-editar').hidden = S.local;
    $('btn-editar').textContent = S.editando ? 'Sair da edição' : 'Editar';
    $('btn-editar').classList.toggle('editando', S.editando);
  }
  function mostrarAviso(txt) {
    const a = $('aviso'); a.replaceChildren(el('span', null, txt));
    const b = el('button', 'btn ghost', 'Descartar as minhas e carregar'); b.addEventListener('click', () => S.remoto && aplicar(S.remoto)); a.append(b);
    a.hidden = false;
  }
  function esconderAviso() { $('aviso').hidden = true; }
  function atualizarBarra() {
    const b = $('barra'); b.hidden = !S.editando;
    if (!S.editando) return;
    const s = sujo();
    $('barra-txt').textContent = s ? 'Alterações não salvas: ' + resumoAlteracoes(JSON.parse(S.base), S.dados) : 'Modo de edição ativo · nenhuma alteração pendente';
    $('b-salvar').disabled = !s || S.salvando; $('b-descartar').disabled = !s;
  }
  $('b-salvar').addEventListener('click', salvar);
  $('b-descartar').addEventListener('click', () => { if (confirm('Descartar as alterações não salvas?')) { S.dados = JSON.parse(S.base); renderTudo(); if (S.remoto) aplicar(S.remoto); } });
  window.addEventListener('beforeunload', (e) => { if (sujo()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- edição / senha ----------
  function abrirSenha() { $('in-nome').value = S.autor; $('in-senha').value = ''; $('senha-erro').hidden = true; $('dlg-senha').showModal(); }
  $('dlg-senha').addEventListener('close', () => { if (!S.editando) S.pendenteConcluir = null; });
  $('btn-editar').addEventListener('click', () => {
    if (S.editando) {
      if (sujo() && !confirm('Há alterações não salvas. Sair da edição e descartá-las?')) return;
      if (sujo()) S.dados = JSON.parse(S.base);
      S.editando = false; renderTudo(); atualizarSync(); return;
    }
    if (!S.editavel) { toast('A edição ainda não foi habilitada neste site (senha não configurada).'); return; }
    if (S.senha && S.autor) { S.editando = true; renderTudo(); atualizarSync(); return; }
    abrirSenha();
  });
  $('form-senha').addEventListener('submit', async (e) => {
    if (e.submitter && e.submitter.value === 'cancelar') return;
    e.preventDefault();
    const nome = $('in-nome').value.trim(), senha = $('in-senha').value;
    if (!nome || !senha) return;
    $('b-entrar').disabled = true;
    try {
      const r = await fetch('/api/senha', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { $('senha-erro').textContent = j.erro || 'Não foi possível validar a senha.'; $('senha-erro').hidden = false; return; }
      S.senha = senha; S.autor = nome; sessionStorage.setItem('m2-senha', senha); localStorage.setItem('m2-autor', nome);
      S.editando = true; $('dlg-senha').close(); renderTudo(); atualizarSync(); toast('Modo de edição ativo');
      if (S.pendenteConcluir) { const id = S.pendenteConcluir; S.pendenteConcluir = null; setTimeout(() => alternarConclusao(id), 150); }
    } catch { $('senha-erro').textContent = 'Sem conexão com o servidor.'; $('senha-erro').hidden = false; }
    finally { $('b-entrar').disabled = false; }
  });

  // ---------- abas ----------
  document.querySelectorAll('.abas button').forEach((b) => b.addEventListener('click', () => {
    S.aba = b.dataset.aba;
    document.querySelectorAll('.abas button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    ['painel', 'planilha', 'historico'].forEach((a) => { $('aba-' + a).hidden = a !== S.aba; });
    renderTudo();
  }));

  // ---------- faixa de controle ----------
  for (let i = 0; i < 16; i++) {
    const p = el('i'); p.style.background = `color-mix(in srgb, ${PH[i % 4]} ${[100, 75, 50, 25][Math.floor(i / 4)]}%, var(--paper))`;
    p.style.animationDelay = i * 45 + 'ms'; $('strip').append(p);
  }

  // ---------- PAINEL ----------
  const F = S.filtro; F.fases = null; F.conhecidas = new Set();
  document.querySelector('.chip[data-fase=""]').addEventListener('click', () => { F.fases = new Set(F.conhecidas); aplicarFiltros(); });
  $('f-spec').addEventListener('click', () => { F.spec = !F.spec; aplicarFiltros(); });
  $('f-frente').addEventListener('change', (e) => { F.frente = e.target.value; aplicarFiltros(); });
  $('f-status').addEventListener('change', (e) => { F.status = e.target.value; aplicarFiltros(); });
  $('f-status').append(new Option('Todos os status', ''), ...STATUS.map((s) => new Option(s, s)));
  $('d-st-sel').append(...STATUS.map((s) => new Option(s, s)));
  const feita = (r) => r.status === 'Concluído';
  const podeMarcar = () => !S.local && S.editavel;

  function aplicarFiltros() {
    const E = S.dados.cronograma;
    document.querySelectorAll('.pill').forEach((p) => {
      const r = E.find((x) => x.id === p.dataset.id); if (!r) return;
      const ok = (!F.frente || r.frente === F.frente) && (!F.status || r.status === F.status) && (!F.spec || r.espectro === 'Sim');
      p.classList.toggle('dim', !ok); p.classList.toggle('on', r.id === S.sel); p.setAttribute('aria-pressed', r.id === S.sel ? 'true' : 'false');
    });
    let visiveis = 0;
    document.querySelectorAll('.phase').forEach((sec) => { const v = F.fases.has(sec.dataset.fase); sec.hidden = !v; if (v) visiveis++; });
    const vazio = $('tl-vazio'); if (vazio) vazio.hidden = visiveis > 0 || !F.conhecidas.size;
    document.querySelectorAll('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', F.fases.has(b.dataset.fase) ? 'true' : 'false'));
    document.querySelector('.chip[data-fase=""]').setAttribute('aria-pressed', F.fases.size === F.conhecidas.size ? 'true' : 'false');
    $('f-spec').setAttribute('aria-pressed', F.spec ? 'true' : 'false');
  }
  const ordemCron = () => [...S.dados.cronograma].sort((a, b) => (a.data || '') < (b.data || '') ? -1 : (a.data || '') > (b.data || '') ? 1 : 0);
  const rodape = () => `Versão ${S.dados.versao} dos dados${S.dados.atualizadoEm ? ', atualizada em ' + hora(S.dados.atualizadoEm) : ''}. Os títulos são resumos; o texto completo aparece ao selecionar cada etapa.`;
  const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.3 2.3 4.7-5"/></svg>';

  function renderIndicadores() {
    const D = S.dados, E = ordemCron(), R = D.resumo || {};
    const et = E.filter((r) => !nota(r)), total = et.length, concl = et.filter(feita).length;
    const spec = et.filter((r) => r.espectro === 'Sim').length, pct = total ? Math.round(100 * concl / total) : 0;
    $('lede').replaceChildren('Das ', el('b', null, total), ' etapas previstas, ', el('b', null, concl), ' estão concluídas e ', el('b', null, spec), ' dependem de medição no espectrofotômetro, hoje concentradas em um único operador.');
    $('leitura').textContent = R.leitura || '';
    const fer = String(R.feriados || '').split(/[,;\s]+/).filter(Boolean);
    $('k-dias').textContent = diasUteis(R.inicio, R.entrega, R.feriados);
    $('k-dias-s').textContent = `De ${fmt(R.inicio)} a ${fmt(R.entrega)}` + (fer.length ? ` · feriado${fer.length > 1 ? 's' : ''} ${fer.map(fmt).join(', ')} descontado${fer.length > 1 ? 's' : ''}` : '');
    $('k-total').textContent = total; $('k-spec').textContent = spec; $('k-pct').textContent = pct;
    requestAnimationFrame(() => setTimeout(() => { $('k-bar').style.width = pct + '%'; }, 60));
    $('k-entrega').textContent = fmtL(R.entrega); $('k-impl').textContent = R.implantacao ? `Implantação completa até ${fmt(R.implantacao)}` : '';
    grafPizza(et, total);
  }

  function marcarCompletos(animar) {
    const E = S.dados.cronograma;
    document.querySelectorAll('.phase').forEach((sec) => {
      const rows = E.filter((r) => r.fase === sec.dataset.fase && !nota(r)), n = rows.length, ok = rows.filter(feita).length;
      const meta = sec.querySelector('.ph-cont'); if (meta) meta.textContent = `${ok} de ${n} ${n === 1 ? 'etapa concluída' : 'etapas concluídas'}`;
      const completa = n > 0 && ok === n, era = sec.classList.contains('completa');
      sec.classList.toggle('completa', completa);
      if (completa && !era && animar && !reduz) { sec.classList.remove('acabou'); void sec.offsetWidth; sec.classList.add('acabou'); }
    });
    document.querySelectorAll('.day').forEach((d) => {
      const rows = E.filter((r) => r.fase === d.dataset.fase && r.data === d.dataset.data && !nota(r));
      const completa = rows.length > 0 && rows.every(feita), era = d.classList.contains('completa');
      d.classList.toggle('completa', completa);
      if (completa && !era && animar && !reduz) { d.classList.remove('acabou'); void d.offsetWidth; d.classList.add('acabou'); }
    });
  }

  function desenharCheck(btn, r, animar) {
    const on = feita(r);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.setProperty('--st', corSt(r.status));
    btn.title = !podeMarcar() ? `Status: ${r.status || '—'}` : on ? 'Concluída – clique para desfazer' : `${r.status || 'Planejado'} – clique para concluir`;
    btn.setAttribute('aria-label', btn.title);
    const pill = btn.closest('.pill'); if (pill) pill.classList.toggle('feita', on);
    if (animar && !reduz) { btn.classList.remove('pop', 'unpop'); void btn.offsetWidth; btn.classList.add(on ? 'pop' : 'unpop'); }
  }

  function alternarConclusao(id) {
    if (!podeMarcar()) { toast('A edição não está disponível nesta página.'); return; }
    if (!S.editando) { S.pendenteConcluir = id; abrirSenha(); return; }
    const r = S.dados.cronograma.find((x) => x.id === id); if (!r) return;
    if (feita(r)) { r.status = r.statusAntes && r.statusAntes !== 'Concluído' ? r.statusAntes : 'Planejado'; delete r.statusAntes; }
    else { r.statusAntes = r.status || 'Planejado'; r.status = 'Concluído'; }
    document.querySelectorAll(`.pill[data-id="${CSS.escape(id)}"] .ck`).forEach((b) => desenharCheck(b, r, true));
    renderIndicadores(); marcarCompletos(true); grafCarga(ordemCron());
    if (S.sel === id) preencherDetalhe();
    aplicarFiltros(); atualizarBarra(); salvar(true);
  }

  function renderPainel() {
    const D = S.dados, E = ordemCron();
    const fases = fasesDe(E), corF = (f) => PH[Math.max(0, fases.indexOf(f)) % 4];
    const et = E.filter((r) => !nota(r));
    // fases visíveis: novas fases entram visíveis
    if (!F.fases) F.fases = new Set(fases);
    fases.forEach((f) => { if (!F.conhecidas.has(f)) F.fases.add(f); });
    F.conhecidas = new Set(fases); [...F.fases].forEach((f) => { if (!F.conhecidas.has(f)) F.fases.delete(f); });
    renderIndicadores();
    $('chips').replaceChildren(...fases.map((f) => {
      const b = el('button', 'chip'); b.dataset.fase = f; b.style.setProperty('--ph', corF(f)); b.append(el('span', 'sw'), el('span', null, f));
      b.title = 'Clique para mostrar ou esconder esta fase';
      b.addEventListener('click', () => { if (F.fases.has(f)) F.fases.delete(f); else F.fases.add(f); aplicarFiltros(); });
      return b;
    }));
    const frentes = Array.from(new Set(et.map((r) => r.frente).filter(Boolean)));
    $('f-frente').replaceChildren(new Option('Todas as frentes', ''), ...frentes.map((f) => new Option(f, f)));
    $('f-frente').value = frentes.includes(F.frente) ? F.frente : (F.frente = '');
    $('f-status').value = F.status;
    const tl = $('timeline'); tl.replaceChildren(); let k = 0; const animar = !reduz && !S.animou; S.animou = true;
    const vazio = el('p', 'tl-vazio', 'Nenhuma fase selecionada. Clique nas fases acima para exibi-las.'); vazio.id = 'tl-vazio'; vazio.hidden = true; tl.append(vazio);
    fases.forEach((f) => {
      const doF = E.filter((r) => r.fase === f), datas = Array.from(new Set(doF.map((r) => r.data))).sort();
      const sec = el('div', 'phase'); sec.dataset.fase = f; sec.style.setProperty('--ph', corF(f));
      const h = el('div', 'ph-head');
      h.append(el('b', null, f), el('span', null, fmt(datas[0]) + (datas.length > 1 ? ' a ' + fmt(datas[datas.length - 1]) : '')), el('span', 'ph-cont'));
      const g = el('div', 'days');
      datas.forEach((dt) => {
        const doD = doF.filter((r) => r.data === dt), c = el('div', 'day'), dh = el('div', 'day-h'), ns = doD.filter((r) => r.espectro === 'Sim').length;
        c.dataset.fase = f; c.dataset.data = dt;
        dh.append(el('b', null, diaSem(dt) + ' ' + fmt(dt)), el('span', 'spec', ns ? '◉ ' + ns : '')); c.append(dh);
        doD.forEach((r) => {
          const p = el('div', 'pill' + (nota(r) ? ' note' : '') + (animar ? ' in' : '')); p.dataset.id = r.id; p.style.animationDelay = Math.min(k++ * 25, 1000) + 'ms';
          p.tabIndex = 0; p.setAttribute('role', 'button');
          const m = el('span', 'm'); m.append(el('span', null, r.frente || ''));
          if (r.espectro === 'Sim') m.append(el('span', 'spec', '◉ espectro'));
          if (r.comentario) m.append(el('span', 'cm', '💬'));
          if (!nota(r)) {
            const ck = el('button', 'ck' + (podeMarcar() ? '' : ' ro')); ck.type = 'button'; ck.innerHTML = CHECK;
            ck.addEventListener('click', (ev) => { ev.stopPropagation(); if (podeMarcar()) alternarConclusao(r.id); });
            ck.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') ev.stopPropagation(); });
            ck.addEventListener('animationend', () => ck.classList.remove('pop', 'unpop'));
            m.append(ck);
          }
          p.append(el('span', 't', r.titulo || r.atividade || '(sem título)'), m);
          p.addEventListener('click', () => selecionar(r.id, true));
          p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selecionar(r.id, true); } });
          c.append(p);
          const ckb = p.querySelector('.ck'); if (ckb) desenharCheck(ckb, r, false);
        });
        c.addEventListener('animationend', () => c.classList.remove('acabou'));
        g.append(c);
      });
      sec.addEventListener('animationend', (ev) => { if (ev.target === sec || ev.target === h) sec.classList.remove('acabou'); });
      sec.append(h, g); tl.append(sec);
    });
    if (S.sel && !E.some((r) => r.id === S.sel)) S.sel = null;
    marcarCompletos(false); preencherDetalhe(); aplicarFiltros(); grafCarga(E);
    $('foot').textContent = rodape();
  }
  function selecionar(id, rolar) {
    S.sel = id; preencherDetalhe(); aplicarFiltros();
    if (rolar && window.innerWidth <= 900) $('detail').scrollIntoView({ block: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
  }
  function preencherDetalhe() {
    const r = S.dados.cronograma.find((x) => x.id === S.sel);
    $('empty').hidden = !!r; $('det').hidden = !r; if (!r) return;
    const fases = fasesDe(S.dados.cronograma);
    $('detail').style.setProperty('--ph', PH[Math.max(0, fases.indexOf(r.fase)) % 4]);
    $('d-kicker').textContent = `${r.fase || ''} · ${diaSem(r.data)} ${fmtL(r.data)}`;
    $('d-titulo').textContent = r.titulo || ''; $('d-frente').textContent = r.frente || '—';
    const s = $('d-status'); s.textContent = r.status || 'Sem status'; s.style.setProperty('--st', corSt(r.status));
    $('d-spec').textContent = r.espectro === 'Sim' ? '◉ Usa o espectrofotômetro' : 'Sem medição';
    ['atividade', 'responsavel', 'entregavel', 'criterio', 'atencao'].forEach((c) => { $('d-' + c).textContent = r[c] || '—'; });
    $('d-comentario').textContent = r.comentario || '—'; $('d-com-box').hidden = !r.comentario && !S.editando;
    $('d-edit').hidden = !S.editando;
    if (S.editando) { $('d-st-sel').value = r.status || 'Planejado'; $('d-com-in').value = r.comentario || ''; }
  }
  $('d-st-sel').addEventListener('change', (e) => { const r = S.dados.cronograma.find((x) => x.id === S.sel); if (!r) return; r.status = e.target.value; delete r.statusAntes; renderPainel(); atualizarBarra(); });
  $('d-com-in').addEventListener('input', (e) => { const r = S.dados.cronograma.find((x) => x.id === S.sel); if (!r) return; r.comentario = e.target.value; $('d-comentario').textContent = r.comentario || '—'; atualizarBarra(); });
  $('d-com-in').addEventListener('change', () => renderPainel());
  function passo(d) {
    const o = ordemCron().filter((r) => !nota(r) && F.fases.has(r.fase)).map((r) => r.id); if (!o.length) return;
    const j = o.indexOf(S.sel), id = o[j < 0 ? 0 : Math.max(0, Math.min(o.length - 1, j + d))];
    selecionar(id); const p = document.querySelector(`.pill[data-id="${CSS.escape(id)}"]`); if (p) p.scrollIntoView({ block: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
  }
  $('prev').addEventListener('click', () => passo(-1)); $('next').addEventListener('click', () => passo(1));
  document.addEventListener('keydown', (e) => {
    if (S.aba !== 'painel' || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); passo(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); }
  });

  const NS = 'http://www.w3.org/2000/svg';
  const sv = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function grafCarga(E) {
    const box = $('carga'); box.replaceChildren();
    const por = new Map(); E.forEach((r) => { if (!r.data) return; if (!por.has(r.data)) por.set(r.data, { data: r.data, n: 0 }); if (r.espectro === 'Sim' && !nota(r)) por.get(r.data).n++; });
    const rows = [...por.values()].sort((a, b) => a.data < b.data ? -1 : 1); if (!rows.length) return;
    const W = Math.max(300, box.clientWidth || 560), H = 240, m = { t: 22, r: 6, b: 40, l: 24 };
    const max = Math.max(1, ...rows.map((r) => r.n)), step = (W - m.l - m.r) / rows.length, bw = step * 0.7, y = (v) => H - m.b - (H - m.t - m.b) * v / max;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Etapas com espectrofotômetro por dia' });
    for (let t = 0; t <= max; t++) { svg.append(sv('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: 'var(--line)' })); const tx = sv('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }); tx.textContent = t; svg.append(tx); }
    const every = step < 28 ? 2 : 1, tip = el('div', 'tip');
    rows.forEach((r, i) => {
      const x = m.l + i * step + (step - bw) / 2, h = y(0) - y(r.n);
      const rc = sv('rect', { x, width: bw, y: y(r.n), height: h, rx: 3, fill: r.n === max ? 'var(--warn)' : 'var(--c)' }); svg.append(rc);
      if (r.n) { const v = sv('text', { x: x + bw / 2, y: y(r.n) - 5, 'text-anchor': 'middle', style: 'fill:var(--ink)' }); v.textContent = r.n; svg.append(v); }
      if (i % every === 0) { const a = sv('text', { x: x + bw / 2, y: H - m.b + 15, 'text-anchor': 'middle' }); a.textContent = fmt(r.data); const b = sv('text', { x: x + bw / 2, y: H - m.b + 28, 'text-anchor': 'middle' }); b.textContent = diaSem(r.data); svg.append(a, b); }
      const hit = sv('rect', { x: m.l + i * step, width: step, y: m.t, height: H - m.t - m.b, fill: 'transparent' });
      hit.addEventListener('pointermove', (ev) => { tip.textContent = `${diaSem(r.data)} ${fmt(r.data)}: ${r.n} ${r.n === 1 ? 'etapa com medição' : 'etapas com medição'}`; const bx = box.getBoundingClientRect(), w = tip.offsetWidth || 160; tip.style.left = Math.max(0, Math.min(bx.width - w, ev.clientX - bx.left - w / 2)) + 'px'; tip.style.top = Math.max(0, ev.clientY - bx.top - 44) + 'px'; tip.style.opacity = 1; });
      hit.addEventListener('pointerleave', () => { tip.style.opacity = 0; }); svg.append(hit);
    });
    box.append(svg, tip);
  }
  function grafPizza(et, total) {
    const box = $('pizza'); box.replaceChildren(); if (!total) return;
    const c = new Map(); et.forEach((r) => c.set(r.status || 'Sem status', (c.get(r.status || 'Sem status') || 0) + 1));
    const rows = [...c].map(([s, n]) => ({ s, n })).sort((a, b) => (STATUS.indexOf(a.s) + 99) % 104 - (STATUS.indexOf(b.s) + 99) % 104);
    const R = 92, r0 = 62, cx = 100, cy = 100;
    const svg = sv('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Distribuição das etapas por status', style: 'max-width:220px;margin:0 auto' });
    const arc = (a, b) => { if (b - a >= 2 * Math.PI - 1e-6) b = a + 2 * Math.PI - 1e-4; const big = b - a > Math.PI ? 1 : 0, p = (r, t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)];
      const [x1, y1] = p(R, a), [x2, y2] = p(R, b), [x3, y3] = p(r0, b), [x4, y4] = p(r0, a); return `M${x1} ${y1}A${R} ${R} 0 ${big} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${big} 0 ${x4} ${y4}Z`; };
    let a0 = -Math.PI / 2; rows.forEach((r) => { const a1 = a0 + 2 * Math.PI * r.n / total; svg.append(sv('path', { d: arc(a0, a1), fill: corSt(r.s) })); a0 = a1; });
    const t1 = sv('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:30px;font-weight:600' }); t1.textContent = total;
    const t2 = sv('text', { x: cx, y: cy + 24, 'text-anchor': 'middle' }); t2.textContent = 'etapas'; svg.append(t1, t2);
    const ul = el('ul', 'legend'); rows.forEach((r) => { const li = el('li'), i = el('i'); i.style.background = corSt(r.s); li.append(i, el('span', null, r.s + ' '), el('b', null, r.n)); ul.append(li); });
    box.append(svg, ul);
  }

  // ---------- PLANILHA ----------
  function campo(valor, tipo, onChange, extraOpcoes) {
    let inp;
    if (Array.isArray(tipo) || tipo === 'fase') {
      const ops = tipo === 'fase' ? extraOpcoes : tipo; inp = el('select');
      const lista = ops.includes(valor ?? '') || valor == null || valor === '' ? ops : [...ops, valor];
      lista.forEach((o) => inp.append(new Option(o === '' ? '—' : o, o))); inp.value = valor == null ? '' : String(valor);
      inp.addEventListener('change', () => onChange(inp.value));
    } else if (tipo === 'long') {
      inp = el('textarea'); inp.rows = Math.min(6, Math.max(2, Math.ceil(String(valor || '').length / 45))); inp.value = valor || '';
      inp.addEventListener('input', () => onChange(inp.value));
    } else {
      inp = el('input'); inp.type = tipo === 'date' ? 'date' : 'text'; inp.value = valor == null ? '' : String(valor);
      inp.addEventListener(tipo === 'date' ? 'change' : 'input', () => onChange(inp.value));
    }
    return inp;
  }
  function renderPlanilha() {
    const D = S.dados, R = D.resumo || (D.resumo = {}), ed = S.editando;
    $('pl-sub').textContent = ed ? 'Edite os campos e clique em Salvar alterações. O painel é atualizado ao salvar e para todos que estiverem com a página aberta.' : 'Para alterar qualquer informação, clique em Editar e informe a senha.';
    const fr = $('form-resumo'); fr.replaceChildren();
    [['inicio', 'Início', 'date'], ['entrega', 'Entrega do caminho viável', 'date'], ['implantacao', 'Implantação completa', 'date'], ['feriados', 'Feriados (AAAA-MM-DD, separados por vírgula)', 'text'], ['leitura', 'Leitura do prazo', 'long', 'largo']].forEach(([k, l, t, c]) => {
      const lab = el('label', c || ''); lab.append(l);
      if (ed) lab.append(campo(R[k], t, (v) => { R[k] = v; atualizarBarra(); }));
      else lab.append(el('span', 'val', t === 'date' ? fmtL(R[k]) : (R[k] || '—')));
      fr.append(lab);
    });
    const tabs = $('tab-tabelas'); tabs.replaceChildren(...Object.entries(SCHEMA).map(([k, s]) => { const b = el('button', 'chip', `${s.nome} (${D[k].length})`); b.setAttribute('aria-pressed', k === S.tabela ? 'true' : 'false'); b.addEventListener('click', () => { S.tabela = k; renderPlanilha(); }); return b; }));
    const sch = SCHEMA[S.tabela], linhas = D[S.tabela], baseMap = new Map((JSON.parse(S.base)[S.tabela] || []).map((r) => [r.id, JSON.stringify(r)]));
    const ac = $('tbl-acoes'); ac.replaceChildren();
    if (ed) {
      const add = el('button', 'btn ghost', '+ Nova linha'); add.addEventListener('click', () => { const n = { id: novoId() }; sch.cols.forEach(([k, , t]) => { n[k] = Array.isArray(t) ? t[0] : ''; }); if (S.tabela === 'cronograma') { n.status = 'Planejado'; n.espectro = 'Não'; } linhas.push(n); renderPlanilha(); atualizarBarra(); const w = document.querySelector('.tbl-wrap'); w.scrollTop = w.scrollHeight; });
      ac.append(add);
      if (sch.ordenar) { const o = el('button', 'btn ghost', 'Ordenar por data'); o.addEventListener('click', () => { linhas.sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1); renderPlanilha(); atualizarBarra(); }); ac.append(o); }
    } else ac.append(el('p', 'sub', 'Visualização somente leitura.'));
    const fases = fasesDe(D.cronograma);
    const tbl = $('tbl'); tbl.replaceChildren();
    const thead = el('thead'), trh = el('tr'); sch.cols.forEach(([, l]) => trh.append(el('th', null, l))); if (ed) trh.append(el('th', null, '')); thead.append(trh);
    const tb = el('tbody');
    linhas.forEach((r, i) => {
      const tr = el('tr'); if (ed && baseMap.get(r.id) !== JSON.stringify(r)) tr.classList.add('mudou');
      sch.cols.forEach(([k, , t, cls]) => {
        const td = el('td', cls || (t === 'long' ? '' : (Array.isArray(t) || t === 'fase') ? 'sel' : 'n'));
        if (ed) td.append(campo(r[k], t, (v) => { r[k] = v; tr.classList.toggle('mudou', baseMap.get(r.id) !== JSON.stringify(r)); atualizarBarra(); }, t === 'fase' ? ['', ...fases] : null));
        else td.textContent = t === 'date' ? fmtL(r[k]) : (r[k] == null || r[k] === '' ? '—' : String(r[k]));
        tr.append(td);
      });
      if (ed) { const td = el('td'), b = el('button', 'del', '✕'); b.title = 'Excluir linha'; b.addEventListener('click', () => { if (confirm('Excluir esta linha? A exclusão só vale depois de salvar.')) { linhas.splice(i, 1); renderPlanilha(); atualizarBarra(); } }); td.append(b); tr.append(td); }
      tb.append(tr);
    });
    tbl.append(thead, tb);
  }

  // ---------- HISTÓRICO ----------
  function renderHistorico() {
    const D = S.dados; $('hist-sub').textContent = `Versão atual: ${D.versao}. Cada alteração salva fica registrada com o nome de quem salvou.`;
    $('hist').replaceChildren(...(D.historico || []).map((h) => { const li = el('li'); li.append(el('div', 'q', `Versão ${h.versao} · ${h.quem} · ${hora(h.quando)}`), el('div', null, h.resumo)); return li; }));
  }

  function renderTudo() {
    if (!S.dados) return;
    if (S.aba === 'painel') renderPainel(); else if (S.aba === 'planilha') renderPlanilha(); else renderHistorico();
    atualizarBarra();
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.aba === 'painel' && S.dados) grafCarga(ordemCron()); }, 200); });

  carregar(false);
  setInterval(() => { if (!document.hidden && !S.salvando && !S.local) carregar(true); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S.local) carregar(true); });
})();
