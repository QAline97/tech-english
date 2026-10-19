# Tech English Daily

App web para praticar o **inglês do dia a dia de quem trabalha com TI**: vocabulário
do trabalho, mensagens do sistema (erros e avisos) e frases para reuniões, chats e e-mails.

Feito para profissionais brasileiros de TI com **inglês básico**. A interface é em
português, e o conteúdo é em inglês com tradução e dicas.

🌐 **Acesse:** https://qaline97.github.io/tech-english/

## Funcionalidades

- **Flashcards de vocabulário** com repetição espaçada (sistema Leitner): as palavras
  que você erra voltam antes, e as que você sabe voltam depois de mais tempo.
- **Quiz de mensagens do sistema**: leia erros e avisos reais (`Connection timed out`,
  `Permission denied`...) e escolha o que eles significam.
- **Quiz de frases do trabalho**: escolha o que dizer na daily, em reuniões, no chat e por e-mail.
- **Pronúncia**: ouça palavras e frases com a voz do próprio navegador (Web Speech API).
- **Acompanhamento de progresso**: dias seguidos, porcentagem de acertos e palavras
  dominadas, tudo salvo no navegador.
- **Validação do conteúdo**: um script Python confere os arquivos de conteúdo e roda
  automaticamente no GitHub Actions.

## Tecnologias

- HTML, CSS e JavaScript puro (ES modules), sem build e sem dependências
- Conteúdo em arquivos JSON
- Python 3 para validar o conteúdo
- GitHub Actions para integração contínua (CI)
- GitHub Pages para hospedagem

## Como rodar localmente

É preciso ter o Python 3 instalado.

```bash
cd tech-english
python -m http.server 8000
```

Depois acesse <http://localhost:8000> no navegador.

> O app carrega os arquivos JSON com `fetch`. Por isso, abrir o `index.html` direto
> (`file://`) não funciona. Use um servidor local.

## Como validar o conteúdo

```bash
python scripts/validate_content.py
```

## Estrutura do projeto

```
tech-english/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # rotas e carregamento dos dados
│   ├── srs.js          # repetição espaçada (Leitner)
│   ├── storage.js      # progresso salvo no localStorage
│   ├── speech.js       # pronúncia (Web Speech API)
│   ├── dates.js, dom.js
│   └── views/          # telas: início, flashcards, quiz
├── data/
│   ├── vocabulary.json
│   ├── messages.json
│   └── phrases.json
└── scripts/validate_content.py
```

## Como adicionar conteúdo

Adicione um novo objeto em um dos arquivos da pasta `data/`, com um `id` único,
e rode o script de validação.

## Próximos passos

- [ ] Lição do dia, com limite diário de palavras novas
- [ ] Modo "revisar meus erros"
- [ ] Modo de escuta: ouvir uma frase e escolher o texto certo
- [ ] Mais conteúdo: entrevistas de emprego e vocabulário de ETL e engenharia de dados
- [ ] Painel de progresso com gráficos
- [ ] Análise do histórico de estudo com Python + pandas (exportado em CSV)
