import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

export const LOJA = "m2flex-gestao-cores";
export const CHAVE = "dados";
export const loja = () => getStore({ name: LOJA, consistency: "strong" });

export const resposta = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const senhaConfigurada = () => Boolean(process.env.EDIT_PASSWORD);

export function senhaConfere(dada) {
  const esperada = process.env.EDIT_PASSWORD || "";
  if (!esperada || typeof dada !== "string" || !dada) return false;
  const a = createHash("sha256").update(dada).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
