# Inglês Técnico Diário

Um aplicativo web para praticar o **inglês usado no dia a dia de trabalhos em TI**:
vocabulário profissional, mensagens do sistema (erros e avisos) e frases para
reuniões, conversas e e-mails.

Feito para profissionais brasileiros de TI com **inglês básico**. A interface
está em português e o conteúdo, em inglês, com traduções e dicas.

## Funcionalidades

- **Flashcards de vocabulário** com repetição espaçada (sistema Leitner): as
  palavras que você errar aparecem novamente mais cedo; as que já souber,
  mais tarde.
- **Quiz de mensagens do sistema**: leia mensagens de erro e aviso realistas
  (`Connection timed out`, `Permission denied`...) e escolha o que significam.
- **Quiz de frases profissionais**: escolha o que dizer em uma conversa rápida,
  reunião, conversa por chat ou e-mail.
- **Tutor de IA** (Claude): converse em inglês e receba correções explicadas em
  português. Três modos:
  - *Conversa livre* sobre o seu trabalho em TI;
  - *Praticar meus erros*: exercícios com os itens que você errou no app;
  - *Simulações*: daily, entrevista de emprego, suporte a incidente e reunião
    com cliente, com feedback no final.

  Dá para falar pelo microfone (Chrome/Edge) e ouvir as respostas.
- **Pronúncia**: ouça palavras e frases (Web Speech API do navegador).
- **Acompanhamento do progresso**: sequência de estudos, precisão e palavras
  dominadas, salvas no navegador.
- **Validação de conteúdo**: um script Python verifica os arquivos de conteúdo
  e é executado automaticamente no GitHub Actions.

## Tecnologias

- HTML, CSS e JavaScript puro (módulos ES), sem etapa de build nem dependências
- Conteúdo armazenado em arquivos JSON
- Python 3: servidor local, tutor de IA ([SDK `anthropic`](https://pypi.org/project/anthropic/)) e validação do conteúdo
- GitHub Actions para integração contínua (CI)

## Como executar

É necessário ter o Python 3.10+ instalado.

```bash
cd tech-english
python -m venv .venv
.venv\Scripts\activate        # Windows (no Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python server.py
```

Abra <http://localhost:8000> no navegador.

> O aplicativo carrega arquivos JSON usando `fetch`, então abrir o `index.html`
> diretamente (`file://`) não funciona. Use o servidor local.

### Configurar o tutor de IA

1. Crie uma chave da API em <https://platform.claude.com/settings/keys>.
2. Copie `.env.example` para `.env` e preencha `ANTHROPIC_API_KEY=`.
3. Reinicie o `python server.py`.

A chave fica só no servidor local (o navegador nunca a vê) e o arquivo `.env`
não vai para o Git. Sem chave, o resto do app funciona normalmente.

O tutor usa o modelo `claude-opus-5-5` com esforço `low` (respostas curtas de
conversa). Dá para trocar com `TUTOR_MODEL` e `TUTOR_EFFORT` no `.env`. Cada
mensagem é uma chamada paga à API; acompanhe o gasto no console da Anthropic.

**Como funciona:** o navegador envia a conversa e um resumo do progresso (só os
ids dos itens errados e os números de acertos) para `POST /api/tutor`. O
servidor busca os detalhes dos itens nos arquivos de `data/`, monta as
instruções do tutor e transmite a resposta do Claude em tempo real. O servidor
só aceita conexões de `localhost` e recusa chamadas vindas de outros sites.

## Como validar o conteúdo e rodar os testes

```bash
python scripts/validate_content.py
python -m unittest discover tests   # não chama a API de verdade
```

## Estrutura do projeto

```
tech-english/
├── index.html
├── server.py           # servidor local: app + API do tutor
├── css/style.css
├── js/
│   ├── app.js          # navegação e carregamento de dados
│   ├── srs.js          # repetição espaçada (Leitner)
│   ├── storage.js      # progresso salvo no localStorage
│   ├── speech.js       # pronúncia e microfone (Web Speech API)
│   ├── tutor-api.js    # chamadas ao tutor (streaming)
│   ├── markdown.js     # formatação segura das respostas
│   ├── dates.js, dom.js
│   └── views/          # início, flashcards, quiz, tutor
├── tutor/
│   ├── prompts.py      # instruções do tutor e simulações
│   ├── session.py      # validação das requisições
│   └── claude.py       # chamada à API do Claude
├── tests/test_tutor.py
├── data/
│   ├── vocabulary.json
│   ├── messages.json
│   └── phrases.json
└── scripts/validate_content.py
```

## Como adicionar conteúdo

Adicione um novo objeto a um dos arquivos em `data/` com um `id` exclusivo
e execute o script de validação.

## Próximas etapas

- [ ] Modo "Revisar meus erros" (os erros já são registrados para o tutor)
- [ ] Salvar o histórico das conversas com o tutor
- [ ] Modo de compreensão auditiva: ouça uma frase e escolha o texto correto
- [ ] Mais conteúdo: entrevistas de emprego, ETL e termos de engenharia de dados
- [ ] Painel de progresso com gráficos
- [ ] Análise do histórico de estudos com Python e pandas (exportado como CSV)
