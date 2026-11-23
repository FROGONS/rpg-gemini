# Processo Scrum (modelo para preencher)

Sprints de 1 semana, papéis de PO e Scrum Master rotativos; todos programam. Quadro no GitHub Projects com **A Fazer, Em Andamento, Em Revisão, Concluído**; branch protegida na `main`, tudo por Pull Request com 1 aprovação e `Closes #N` na descrição.

## Rodízio de papéis (preencher)

| Sprint | Product Owner | Scrum Master |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |

## Metas e incrementos sugeridos

| Sprint | Meta (1 frase) | Histórias de usuário sugeridas |
|---|---|---|
| 1 | Repositório protegido, banco no ar e chamada de teste ao Gemini validada | Configurar repositório, branch protection e quadro. Criar `schema.sql` e diagrama ER. Prototipar a tela do jogo. Validar chamada básica à API do Gemini. |
| 2 | Usuário se cadastra, faz login e cria personagem com retrato gerado por IA | Cadastro e login (bcrypt + JWT). Formulário de personagem com descrição visual e atributos. Geração do avatar com tratamento de 429. Exibir status "gerando". |
| 3 | 1º jogador cria a sala, o Gemini monta a campanha e 2+ jogadores entram em tempo real | Criar sala com tema e tom. Campanha e árvore de mapas (JSON). Descrição e imagem do 1º mapa. Entrar por código. Socket.io com salas. |
| 4 | Ciclo de jogo completo, polimento e entregas | Ação e fala por WebSocket. Arbitragem, d20 e dano no servidor. Narração e NPCs. Troca de mapa e fim de campanha. Vídeo, slides e ZIP. |

## Cerimônias (resumo de cada sprint para o slide 8)

Preencha após cada sprint: meta cumprida? (sim/parcial/não), pontos planejados x entregues (velocidade), principal impedimento, 1 a 3 ações de melhoria da retrospectiva.

| Sprint | Pontos planejados | Pontos entregues | Aprendizado principal |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

## Definição de pronto

PR aprovado por um colega, testado na `main`, critérios de aceite do PO atendidos, sem chave ou `.env` no repositório.
