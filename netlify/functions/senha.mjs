import { resposta, senhaConfigurada, senhaConfere, esperar } from "./_comum.mjs";

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);
  if (!senhaConfigurada())
    return resposta({ erro: "A senha de edição ainda não foi configurada no site (variável EDIT_PASSWORD)." }, 503);
  let corpo = {};
  try { corpo = await req.json(); } catch { /* corpo inválido */ }
  if (!senhaConfere(corpo.senha)) {
    await esperar(800);
    return resposta({ erro: "Senha incorreta." }, 401);
  }
  return resposta({ ok: true });
};

export const config = { path: "/api/senha" };
