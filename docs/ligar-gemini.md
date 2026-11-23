# Como ligar o Gemini de verdade

1. **Crie a chave** em https://aistudio.google.com/apikey (conta Google). Copie o valor.
2. No arquivo `.env` (cópia do `.env.example`), preencha:
   ```
   GEMINI_API_KEY=cole_a_chave_aqui
   GEMINI_TEXT_MODEL=gemini-3.5-flash
   GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
   GEMINI_MOCK=false
   ```
3. **Confira os nomes dos modelos** em https://ai.google.dev/gemini-api/docs/models. Eles mudam com o tempo e dependem do plano da sua chave.
   * Texto (Mestre e NPCs): qualquer modelo `gemini-*-flash` de texto.
   * Imagem (Nano Banana): um modelo `gemini-*-image`. Também funciona um modelo `imagen-*` (o código detecta pelo prefixo e usa `generateImages`).
4. Reinicie com `npm start`. No terminal deve aparecer `IA: Gemini ativo (texto: … | imagem: …)` e o selo "Modo demonstração" some das telas.
5. **Teste na ordem**: criar personagem (retrato) → criar sala (campanha + imagem do mapa) → iniciar → enviar uma ação.

## Se algo falhar

| Sintoma | Causa provável |
|---|---|
| Retrato ou mapa em "erro" | Modelo de imagem indisponível no seu plano, bloqueio de segurança por causa da descrição, ou cota. Use o botão "Gerar de novo". |
| Aviso "A IA recebeu muitas requisições" | Erro 429 (limite da cota). O servidor já tenta 3 vezes com espera crescente; depois mostra o aviso e o botão **Tentar novamente**. |
| "A IA recusou a requisição" | Chave inválida ou nome de modelo errado no `.env`. |
| Resposta em formato inesperado | O modelo devolveu algo que não é JSON; o servidor tenta duas vezes e depois pede para repetir. |

O plano gratuito costuma ter limite baixo de requisições por minuto e de imagens por dia. Para a gravação do vídeo, faça um teste completo antes e deixe alguns minutos entre as tentativas.

## Onde está cada parte no código (para a demonstração técnica)

* Chave lida só em `src/config/env.js`; usada só em `src/services/geminiService.js`.
* Prompt do Mestre e formatos JSON: `src/services/mestreService.js`.
* Prompts de imagem e estilo padronizado: `src/services/imageService.js` e `AVATAR_STYLE` / `CENARIO_STYLE` no `.env`.
* Tratamento do 429: `comRetry` e `traduzirErro` em `src/services/geminiService.js`; aviso na tela em `public/js/sala.js` (`mostrarAlerta`).
