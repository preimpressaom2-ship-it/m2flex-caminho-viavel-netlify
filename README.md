# Caminho viável para campanhas nacionais – M2flex

Site com o **painel** e a **planilha** do cronograma de gestão de cores.
Qualquer pessoa com o link visualiza. Para editar, é preciso a **senha de edição**.
As alterações ficam salvas na Netlify (Netlify Blobs) e aparecem para todos que estiverem com a página aberta em até 20 segundos.

## O que tem no site

- **Painel:** indicadores, cronograma por fase (título resumido; clique para ver o texto completo), filtros e gráficos.
  No modo de edição, o painel lateral permite mudar o status da etapa e registrar um **comentário da gestão**.
- **Planilha:** as cinco tabelas (Cronograma, Conjuntos, Riscos, Pendências, Papéis) e as datas do prazo, editáveis.
- **Histórico:** cada salvamento registra versão, nome de quem salvou, data e resumo das mudanças.
- Se duas pessoas editarem ao mesmo tempo, o site avisa e oferece **juntar** as alterações (as linhas que você mudou entram na versão nova; as da outra pessoa são mantidas) ou recarregar.
- Cada versão salva também fica guardada como cópia de segurança (`versoes/00001`, `versoes/00002`…) no armazenamento do site.

## Estrutura

```
netlify.toml                      configuração da Netlify
package.json                      dependência @netlify/blobs
public/                           site (index.html, app.js, estilo.css, dados-iniciais.json)
netlify/functions/dados.mjs       GET/PUT /api/dados – lê e salva a planilha
netlify/functions/senha.mjs       POST /api/senha – confere a senha de edição
netlify/functions/_comum.mjs      funções compartilhadas
netlify/functions/dados-iniciais.mjs   conteúdo inicial (cronograma de 10/11/2026)
```

## Como publicar

O site usa **funções da Netlify**. Por isso, publique por um destes caminhos
(arrastar a pasta para a Netlify pode publicar só a parte estática, sem salvar alterações):

**Opção A – GitHub (recomendada):**
1. Crie um repositório no GitHub e envie todo o conteúdo desta pasta.
2. Na Netlify: *Add new site → Import an existing project* → escolha o repositório.
   As configurações de build já vêm do `netlify.toml`; basta confirmar.

**Opção B – Netlify CLI (pelo terminal, dentro desta pasta):**
```
npm install
npx netlify-cli login
npx netlify-cli deploy --prod
```

## Definir a senha de edição (obrigatório para editar)

1. No site, na Netlify, abra as configurações de **variáveis de ambiente** (Environment variables).
2. Crie a variável **`EDIT_PASSWORD`** com a senha escolhida (disponível para Functions).
3. Faça um novo deploy (*Deploys → Trigger deploy*) para a senha passar a valer.

Sem essa variável, o site funciona apenas para visualização.
Para trocar a senha, altere a variável e faça um novo deploy; quem estiver editando precisará entrar de novo.

## Observações

- A senha é única e compartilhada. Distribua apenas para quem deve editar.
- Na primeira abertura, o site grava automaticamente o conteúdo inicial; depois disso, o que vale é sempre a versão salva.
- Abrindo o `index.html` direto do computador (sem a Netlify), o site mostra a versão inicial em modo somente leitura.
