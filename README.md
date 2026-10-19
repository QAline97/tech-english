# Tech English Daily

A web app to practice the **English used every day in IT jobs**: work vocabulary,
system messages (errors and warnings) and phrases for meetings, chats and emails.

Built for Brazilian IT professionals with **basic English**. The interface is in
Portuguese and the content is in English, with translations and tips.

## Features

- **Vocabulary flashcards** with spaced repetition (Leitner system): words you
  miss come back sooner, and words you know come back later.
- **System messages quiz**: read real-looking error and warning messages
  (`Connection timed out`, `Permission denied`...) and choose what they mean.
- **Work phrases quiz**: choose what to say in a daily, a meeting, a chat or an email.
- **Pronunciation**: listen to words and phrases (browser Web Speech API).
- **Progress tracking**: study streak, accuracy and mastered words, saved in the browser.
- **Content validation**: a Python script checks the content files, and it runs
  automatically on GitHub Actions.

## Tech stack

- HTML, CSS and vanilla JavaScript (ES modules), with no build step and no dependencies
- Content stored as JSON files
- Python 3 for content validation
- GitHub Actions for CI

## How to run

You need Python 3 installed.

```bash
cd tech-english
python -m http.server 8000
```

Open <http://localhost:8000> in your browser.

> The app loads JSON files with `fetch`, so opening `index.html` directly
> (`file://`) does not work. Use a local server.

## How to validate the content

```bash
python scripts/validate_content.py
```

## Project structure

```
tech-english/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # routing and data loading
│   ├── srs.js          # spaced repetition (Leitner)
│   ├── storage.js      # progress saved in localStorage
│   ├── speech.js       # pronunciation (Web Speech API)
│   ├── dates.js, dom.js
│   └── views/          # home, flashcards, quiz
├── data/
│   ├── vocabulary.json
│   ├── messages.json
│   └── phrases.json
└── scripts/validate_content.py
```

## How to add content

Add a new object to one of the files in `data/` with a unique `id`,
then run the validation script.

## Roadmap

- [ ] "Review my mistakes" mode
- [ ] Listening mode: hear a phrase and choose the right text
- [ ] More content: job interviews, ETL and data engineering words
- [ ] Progress dashboard with charts
- [ ] Python + pandas analysis of study history (exported as CSV)
