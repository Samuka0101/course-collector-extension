# Course Information Collector

A Manifest V3 extension for Chrome and Edge that catalogs information visible to signed-in learners on Plataforma Assaad. It opens course pages in temporary background tabs and records headings, links, visible text, progress labels, and references to embedded video players. The interface is in Brazilian Portuguese.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**, select **Load unpacked**, and choose the folder that contains [`manifest.json`](manifest.json).

## Collect and export

1. Sign in to Plataforma Assaad and open its dashboard.
2. Open **Coletor de Informações do Curso** from the browser toolbar.
3. Choose a section and a page limit, then select **Coletar informações do curso**. You can reopen the popup to check progress.
4. Select **Exportar informações (.json)** to save the result to your computer. Use **Limpar dados salvos** to clear local results after collection.

Available sections include courses, question banks, practice exams, materials, tools, and mentoring. Collection follows same-origin links and skips routes such as payment and logout. Page coverage depends on the layout and what appears in the signed-in session.

## Data and permissions

The content script runs on `https://app.plataformaassaad.com.br/`. Results stay in browser extension storage until you export or clear them. The JSON can include account-specific progress, visible course text, and URLs. Video and document links are recorded as references.
