# ЕГЭ PWA — готовый dist

Этот архив можно загрузить на Cloudflare Pages как готовую папку `dist`.

## Что внутри

- `index.html` — приложение
- `assets/app.js` и `assets/app.css` — логика и дизайн
- `data/content.json` — формулы и теория
- `data/tasks/index.json` — индекс всех задач
- `data/tasks/math/*.json` — задачи математики по номерам ЕГЭ
- `data/tasks/physics/*.json` — задачи физики по номерам ЕГЭ
- `sw.js` — service worker для PWA и офлайн-кэша
- `manifest.json` и `icons/*` — установка на телефон

## Куда добавить картинки задач

Добавь свои картинки в эти папки, сохранив имена файлов из JSON:

```text
assets/ege_math/problem_images/
assets/ege_phys/problem_images/
```

Например, если в задаче указан путь:

```text
assets/ege_math/problem_images/file_138128.svg
```

то файл должен лежать именно там.

## Cloudflare Pages

Если загружаешь только `dist`, можно использовать Direct Upload.
Если через проект с GitHub:

```text
Build command: npm run build
Output directory: dist
```

Но этот архив уже является готовым output directory.
