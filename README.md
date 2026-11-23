# RPG Multiplayer com Gemini

RPG de texto cooperativo em tempo real. O **Google Gemini** é o Mestre do Jogo (e interpreta todos os NPCs) e também gera os retratos dos personagens e as ilustrações dos cenários. O servidor Node.js cuida das regras: vida, dados (d20), dano, inventário e troca de mapas. A IA só narra o resultado, nunca o contrário.

## Como rodar

Requisitos: **Node.js 18+** e **MySQL 8.0.16+** (os `CHECK` do schema só são aplicados a partir dessa versão).

```bash
npm install
cp .env.example .env     # no Windows: copy .env.example .env
# edite o .env com usuário e senha do seu MySQL
npm start
```

Abra http://localhost:3000. O banco e as tabelas são criados sozinhos na primeira execução (`database/schema.sql`, idempotente). Para criar só o schema: `npm run migrate`.

### Modo demonstração x Gemini real

* **Sem `GEMINI_API_KEY`** no `.env`, o jogo roda em **modo demonstração**: o Mestre e as imagens são simulados no próprio servidor (aparece um selo "Modo demonstração" nas telas). Serve para testar tudo sem chave.
* **Com a chave**, o servidor usa o Gemini de verdade. Passo a passo em [`docs/ligar-gemini.md`](docs/ligar-gemini.md).
* Para mostrar o aviso de erro 429 sem gastar cota: `MOCK_SIMULAR_429=0.3` no `.env` (30% das chamadas simuladas falham com rate limit).

### Testes

```bash
npm test      # regras do jogo, validação das respostas da IA e tradução do erro 429
```

## Como jogar (para a demonstração)

1. Crie uma conta e um personagem (nome, classe, descrição visual e 12 pontos de atributo). O retrato é gerado pela IA em segundo plano.
2. O 1º jogador **cria a sala** (nome, tema e tom). O Mestre cria prelúdio, objetivo e uma árvore de mapas, descreve o 1º local e gera a imagem.
3. O 2º jogador **entra pelo código** de 6 letras, em outro navegador.
4. O anfitrião clica em **Iniciar aventura**. Todos enviam **ações** ou **falas**; o Mestre narra, os NPCs respondem e o grupo avança de cenário.

## Regras (todas no servidor)

| Regra | Como funciona |
|---|---|
| Atributos | Seis atributos partem de 10 (faixa 8 a 16), com **12 pontos** para distribuir. Modificador = `floor((valor − 10) / 2)`. |
| Vida máxima | `10 + 2 × modificador de Constituição` (mínimo 6). |
| Teste | A IA decide **se** há teste, o atributo e a dificuldade (CD 5 a 25). O servidor rola **d20 + modificador** contra a CD. 20 natural sempre passa e 1 natural sempre falha. |
| Dano ao jogador | Se o teste falha e a ação é arriscada: baixo 1d4, médio 1d6, alto 2d6 (dobra na falha crítica). |
| Ataques | Ataque exige teste; se acerta, causa 1d6 + modificador ao NPC (dobra no crítico). |
| Queda | Com 0 de vida o personagem fica **caído** e não age. Se todos caem, a campanha acaba (derrota). |
| Itens e NPCs | A IA sugere, o servidor valida: só em ação bem-sucedida, no máximo 12 itens por personagem e 6 NPCs por mapa. |
| Mapas | A IA sugere avançar; o servidor só aceita se a ação deu certo, se houve ao menos `MIN_ACOES_POR_MAPA` ações no mapa e se existe uma saída. Ao avançar, todos descansam (caídos voltam com metade da vida, os demais recuperam 25%). |
| Fim | Chegar a um local final e cumprir o objetivo encerra a campanha (vitória). |

## Estrutura

```
server.js                 inicialização (Express + Socket.io + migração)
database/schema.sql       schema relacional (MySQL)
src/config/               variáveis de ambiente e pool MySQL
src/routes/               rotas REST  ->  src/controllers/
src/models/               acesso ao banco (um arquivo por entidade)
src/services/
  regrasService.js        dados, atributos, dano (sem IA)
  mestreService.js        prompts e validação das respostas do Gemini
  geminiService.js        cliente @google/genai, retry e erro 429
  imageService.js         prompts de imagem (retrato e cenário)
  jogoService.js          ciclo da ação, efeitos e troca de mapa
  campanhaService.js      criar/entrar em sala, campanha e mapas
  personagemService.js    personagem e avatar em segundo plano
  mockIA.js               modo demonstração
src/sockets/gameSocket.js eventos em tempo real
public/                   front-end (HTML5, CSS3 grid/flex, JS vanilla)
docs/                     ER, fluxograma, arquitetura, roteiro do vídeo, Scrum
test/                     testes automatizados
```

## API REST (JSON, `Authorization: Bearer <jwt>`)

| Método e rota | Descrição |
|---|---|
| `POST /api/auth/cadastro`, `POST /api/auth/login`, `GET /api/auth/me` | Conta e sessão (bcrypt + JWT) |
| `GET/POST /api/personagens`, `GET /api/personagens/:id`, `POST /api/personagens/:id/avatar` | Personagens e retrato (polling do status) |
| `POST /api/salas`, `POST /api/salas/entrar`, `GET /api/salas/minhas`, `POST /api/salas/:codigo/sair` | Salas |
| `GET /api/config` | Público: informa se está em modo demonstração |

## Eventos Socket.io (autenticados pelo JWT)

Cliente → servidor: `sala:conectar`, `sala:iniciar`, `acao:enviar`, `acao:reenviar`, `mapa:regerar-imagem`.
Servidor → sala: `mensagem`, `rolagem`, `participantes`, `npcs`, `presenca`, `sala:status`, `mapa:atualizado`, `mapa:imagem`, `mestre:digitando`, `aviso`.

## Segurança

* Chave do Gemini e segredo do JWT ficam só no `.env` (fora do Git e do ZIP). O front-end nunca recebe chaves.
* Senhas com bcrypt (`bcryptjs`, mesmo algoritmo, sem compilação nativa); rotas privadas e WebSocket exigem JWT.
* Texto de jogador e resposta da IA nunca viram HTML (o front usa `textContent`); a resposta da IA é normalizada e limitada antes de tocar no banco.
* Texto do jogador vai ao Gemini dentro de delimitadores e o prompt do sistema o trata como fala dentro da ficção (defesa contra *prompt injection*). Mesmo assim, o servidor é quem decide números e mudanças de estado.
