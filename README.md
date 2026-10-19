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
- **Pronúncia**: ouça palavras e frases (Web Speech API do navegador).
- **Acompanhamento do progresso**: sequência de estudos, precisão e palavras
  dominadas, salvas no navegador.
- **Validação de conteúdo**: um script Python verifica os arquivos de conteúdo
  e é executado automaticamente no GitHub Actions.

## Tecnologias

- HTML, CSS e JavaScript puro (módulos ES), sem etapa de build nem dependências
- Conteúdo armazenado em arquivos JSON
- Python 3 para validação do conteúdo
- GitHub Actions para integração contínua (CI)

## Como executar

É necessário ter o Python 3 instalado.

```bash
cd tech-english
python -m http.server 8000
```

Abra <http://localhost:8000> no navegador.

> O aplicativo carrega arquivos JSON usando `fetch`, então abrir o `index.html`
> diretamente (`file://`) não funciona. Use um servidor local.

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
│   ├── app.js          # navegação e carregamento de dados
│   ├── srs.js          # repetição espaçada (Leitner)
│   ├── storage.js      # progresso salvo no localStorage
│   ├── speech.js       # pronúncia (Web Speech API)
│   ├── dates.js, dom.js
│   └── views/          # início, flashcards, quiz
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

- [ ] Modo "Revisar meus erros"
- [ ] Modo de compreensão auditiva: ouça uma frase e escolha o texto correto
- [ ] Mais conteúdo: entrevistas de emprego, ETL e termos de engenharia de dados
- [ ] Painel de progresso com gráficos
- [ ] Análise do histórico de estudos com Python e pandas (exportado como CSV)
