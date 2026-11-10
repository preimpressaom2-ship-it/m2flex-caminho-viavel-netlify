import { loja, CHAVE, resposta, senhaConfigurada, senhaConfere, esperar } from "./_comum.mjs";
import inicial from "./dados-iniciais.mjs";

const TABELAS = ["cronograma", "conjuntos", "riscos", "pendencias", "papeis"];
const MAX_BYTES = 1_500_000;
const MAX_LINHAS = 500;
const MAX_TEXTO = 5000;

function validar(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "Formato de dados inválido.";
  if (!d.resumo || typeof d.resumo !== "object") return "Resumo ausente.";
  for (const t of TABELAS) {
    if (!Array.isArray(d[t])) return `Tabela ${t} ausente.`;
    if (d[t].length > MAX_LINHAS) return `Tabela ${t} com linhas demais.`;
    for (const linha of d[t]) {
      if (!linha || typeof linha !== "object" || Array.isArray(linha)) return `Linha inválida em ${t}.`;
      for (const v of Object.values(linha)) {
        if (v !== null && !["string", "number", "boolean"].includes(typeof v)) return `Valor inválido em ${t}.`;
        if (typeof v === "string" && v.length > MAX_TEXTO) return `Texto longo demais em ${t}.`;
      }
    }
  }
  return null;
}

export default async (req) => {
  const store = loja();

  if (req.method === "GET") {
    let atual = await store.getWithMetadata(CHAVE, { type: "json" });
    if (!atual) {
      await store.setJSON(CHAVE, inicial, { onlyIfNew: true });
      atual = await store.getWithMetadata(CHAVE, { type: "json" });
    }
    return resposta({ dados: atual.data, etag: atual.etag, editavel: senhaConfigurada() });
  }

  if (req.method === "PUT") {
    if (!senhaConfigurada())
      return resposta({ erro: "A senha de edição ainda não foi configurada no site (variável EDIT_PASSWORD)." }, 503);
    if (!senhaConfere(req.headers.get("x-senha"))) {
      await esperar(800);
      return resposta({ erro: "Senha incorreta." }, 401);
    }
    const texto = await req.text();
    if (texto.length > MAX_BYTES) return resposta({ erro: "Dados grandes demais." }, 413);
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return resposta({ erro: "JSON inválido." }, 400); }
    const problema = validar(corpo.dados);
    if (problema) return resposta({ erro: problema }, 400);

    const atual = await store.getWithMetadata(CHAVE, { type: "json" });
    if (atual && corpo.etag !== atual.etag)
      return resposta({ erro: "conflito", dados: atual.data, etag: atual.etag }, 409);

    const anterior = atual ? atual.data : inicial;
    const agora = new Date().toISOString();
    const autor = String(corpo.autor || "Sem nome").slice(0, 80);
    const novo = {};
    for (const t of TABELAS) novo[t] = corpo.dados[t];
    novo.resumo = corpo.dados.resumo;
    novo.versao = (anterior.versao || 0) + 1;
    novo.atualizadoEm = agora;
    novo.atualizadoPor = autor;
    novo.historico = [
      { versao: novo.versao, quando: agora, quem: autor, resumo: String(corpo.resumo || "Alteração").slice(0, 400) },
      ...(Array.isArray(anterior.historico) ? anterior.historico : []),
    ].slice(0, 300);

    const r = atual
      ? await store.setJSON(CHAVE, novo, { onlyIfMatch: atual.etag })
      : await store.setJSON(CHAVE, novo, { onlyIfNew: true });
    if (r && r.modified === false) {
      const recente = await store.getWithMetadata(CHAVE, { type: "json" });
      return resposta({ erro: "conflito", dados: recente.data, etag: recente.etag }, 409);
    }
    // cópia de segurança de cada versão
    await store.setJSON(`versoes/${String(novo.versao).padStart(5, "0")}`, novo);
    return resposta({ dados: novo, etag: r.etag });
  }

  return resposta({ erro: "Método não permitido." }, 405);
};

export const config = { path: "/api/dados" };
