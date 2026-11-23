# Roteiro do vídeo de demonstração (4 a 6 minutos)

**Antes de gravar**: rode `npm start` com o Gemini ligado (veja `docs/ligar-gemini.md`), faça um teste completo para aquecer e confira a cota. Use **dois navegadores** (ou uma janela anônima) lado a lado. Deixe o editor aberto com `.env.example`, `src/routes/index.js` e `src/services/geminiService.js`. Quem fala é quem estiver operando cada navegador.

| Tempo | Cena | O que mostrar e dizer |
|---|---|---|
| 0:00 a 0:20 | Abertura | Nome do jogo, integrantes e a ideia: "RPG de texto cooperativo em tempo real em que o Gemini é o Mestre". |
| 0:20 a 1:30 | **1. Cadastro e personagem** | Criar conta. Criar o personagem digitando nome, classe, **descrição visual** e distribuindo os 12 pontos. Clicar em criar e mostrar o **retrato "gerando…"** virando a imagem feita pela IA. Dizer que o prompt de estilo é padronizado. |
| 1:30 a 2:45 | **2. Criação da sala** | Navegador 1: nome da aventura e **tema livre** (ex.: "Ruínas de Sabará 2099, sci-fi distópico com folclore mineiro"). Clicar em criar e mostrar o Mestre montando prelúdio, objetivo e mapas, e a **descrição e a imagem do 1º cenário**. Abrir "A aventura" na lateral para mostrar o objetivo. |
| 2:45 a 4:30 | **3. Dois navegadores em tempo real** | Navegador 2: criar conta e personagem, **entrar pelo código**. Mostrar o jogador aparecendo no grupo do outro navegador. Anfitrião clica em **Iniciar**. Cada um envia uma ação: mostrar a narração chegando nos dois ao mesmo tempo, o **dado d20** com CD e resultado, o dano e a vida mudando, um item no inventário e um **NPC** respondendo. Avançar de mapa e mostrar o novo cenário com imagem. |
| 4:30 a 5:30 | **4. Visão técnica** | Mostrar `.env.example` (só os nomes das variáveis; a chave real não aparece). Mostrar a rota em `src/routes/index.js` e o fluxo até `geminiService.js` ("a chave só existe no servidor"). Mostrar o `comRetry` do erro 429. Se possível, ligar `MOCK_SIMULAR_429` e mostrar o aviso "Tentar novamente" na tela. |
| 5:30 a 6:00 | Encerramento | Resumir: regras no servidor, IA narra, tempo real, imagens geradas. Agradecer. |

## Checklist de gravação

- [ ] Gemini ligado e testado antes (selo "Modo demonstração" **não** aparece).
- [ ] Banco limpo ou usuários de teste com nomes bons.
- [ ] Tema de sala curto e criativo (a IA responde melhor).
- [ ] Nenhuma chave visível na tela (feche o `.env`).
- [ ] Áudio claro e resolução 1080p; publicar como "não listado" no YouTube ou link do Drive com acesso liberado.
