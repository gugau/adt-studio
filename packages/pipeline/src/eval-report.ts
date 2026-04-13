import type { PageEvaluation, AggregatedScores } from "./eval-judge.js"
import type { ImprovementPlan } from "./eval-improver.js"
import type { TypeDef } from "@adt/types"

export interface ReportPageData {
  pageId: string
  pageNumber: number
  ocrText: string
  imageBase64: string
}

export interface ReportIterationPageResult {
  pageId: string
  structuringResult: unknown
  evaluation: PageEvaluation | null
  error: string | null
}

export interface ReportIteration {
  iteration: number
  config: {
    textTypes: TypeDef[]
    containerTypes: TypeDef[]
  }
  promptText: string
  pageResults: ReportIterationPageResult[]
  /** Test set scores (odd pages — measures generalization) */
  aggregatedScores: AggregatedScores | null
  /** Train set scores (even pages — used for improvements) */
  trainScores: AggregatedScores | null
  improvementPlan: ImprovementPlan | null
}

export interface ReportData {
  bookLabel: string
  timestamp: string
  judgeModel: string
  structureModel: string
  pages: ReportPageData[]
  /** Page numbers in the train set (even — used for improvements) */
  trainPageNumbers: number[]
  /** Page numbers in the test set (odd — measures generalization) */
  testPageNumbers: number[]
  iterations: ReportIteration[]
}

export function generateReport(data: ReportData): string {
  const jsonData = JSON.stringify(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval Report: ${escHtml(data.bookLabel)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f172a; --surface: #1e293b; --surface2: #334155;
    --text: #e2e8f0; --text-muted: #94a3b8; --accent: #38bdf8;
    --green: #4ade80; --yellow: #fbbf24; --red: #f87171;
    --border: #475569; --radius: 8px;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 4px; }
  h2 { font-size: 1.2rem; font-weight: 600; margin-bottom: 12px; color: var(--accent); }
  h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
  .subtitle { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 24px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 16px; overflow-x: auto; }
  .tab { padding: 8px 16px; cursor: pointer; border: none; background: none; color: var(--text-muted); font-size: 0.875rem; border-bottom: 2px solid transparent; white-space: nowrap; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--border); }
  th { color: var(--text-muted); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td:first-child, th:first-child { text-align: left; }
  .score { font-weight: 600; font-variant-numeric: tabular-nums; }
  .score-high { color: var(--green); }
  .score-mid { color: var(--yellow); }
  .score-low { color: var(--red); }
  .issue { padding: 4px 0; font-size: 0.8rem; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .badge-high { background: rgba(248,113,113,0.2); color: var(--red); }
  .badge-medium { background: rgba(251,191,36,0.2); color: var(--yellow); }
  .badge-low { background: rgba(148,163,184,0.2); color: var(--text-muted); }
  .change-modify { color: var(--yellow); }
  .page-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .page-image { width: 100%; border-radius: var(--radius); border: 1px solid var(--border); }
  .tree-view { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; line-height: 1.8; max-height: 500px; overflow-y: auto; }
  .tree-node { padding-left: 20px; border-left: 1px solid var(--border); }
  .tree-label { color: var(--accent); font-weight: 600; }
  .tree-text { color: var(--text-muted); }
  .tree-image-ref { color: var(--yellow); font-style: italic; }
  pre { background: var(--bg); padding: 12px; border-radius: var(--radius); overflow-x: auto; font-size: 0.75rem; max-height: 400px; overflow-y: auto; }
  .prompt-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .prompt-box { max-height: 400px; overflow-y: auto; }
  .chart-bar-container { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .chart-bar-label { width: 80px; font-size: 0.75rem; color: var(--text-muted); text-align: right; flex-shrink: 0; }
  .chart-bar-track { flex: 1; height: 20px; background: var(--bg); border-radius: 4px; overflow: hidden; position: relative; }
  .chart-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; font-size: 0.7rem; font-weight: 600; }
  .iteration-scores { display: flex; gap: 8px; flex-wrap: wrap; }
  .iteration-score-chip { padding: 4px 12px; border-radius: 16px; font-size: 0.8rem; font-weight: 600; background: var(--surface2); }
  .collapsible-header { cursor: pointer; display: flex; align-items: center; gap: 8px; user-select: none; }
  .collapsible-header::before { content: '\\25B6'; font-size: 0.6rem; transition: transform 0.2s; }
  .collapsible-header.open::before { transform: rotate(90deg); }
  .collapsible-body { display: none; margin-top: 8px; }
  .collapsible-body.open { display: block; }
  .flex { display: flex; }
  .gap-4 { gap: 16px; }
  .flex-1 { flex: 1; min-width: 0; }
  .mb-4 { margin-bottom: 16px; }
</style>
</head>
<body>
<div class="container">
  <h1>Page Structuring Evaluation</h1>
  <div class="subtitle">${escHtml(data.bookLabel)} &mdash; ${escHtml(data.timestamp)} &mdash; Structure: ${escHtml(data.structureModel)} &mdash; Judge: ${escHtml(data.judgeModel)}</div>

  <div id="app"></div>
</div>

<script>
const DATA = ${jsonData};

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'innerHTML') el.innerHTML = v;
    else el.setAttribute(k, v);
  });
  children.flat(Infinity).forEach(c => {
    if (c == null) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

function scoreClass(s) { return s >= 7.5 ? 'score-high' : s >= 5 ? 'score-mid' : 'score-low'; }
function fmt(n) { return n != null ? n.toFixed(1) : '-'; }

function barColor(s) { return s >= 7.5 ? 'var(--green)' : s >= 5 ? 'var(--yellow)' : 'var(--red)'; }

function renderBar(label, value, max) {
  max = max || 10;
  const pct = (value / max * 100).toFixed(1);
  return h('div', {className: 'chart-bar-container'},
    h('div', {className: 'chart-bar-label'}, label),
    h('div', {className: 'chart-bar-track'},
      h('div', {className: 'chart-bar-fill', style: 'width:'+pct+'%;background:'+barColor(value)}, fmt(value))
    )
  );
}

function renderScoreTable(title, iters, getScores) {
  if (iters.length === 0) return h('div', null, 'No scores yet.');
  const dims = ['overall','text_completeness','text_accuracy','tree_structure','type_accuracy','image_placement','reading_order'];
  const labels = ['Overall','Text Comp.','Accuracy','Structure','Types','Images','Order'];
  const wrapper = h('div', {style: 'margin-bottom:12px'});
  wrapper.appendChild(h('h3', null, title));
  const tbl = h('table');
  const thead = h('tr', null, h('th', null, 'Iteration'), ...labels.map(l => h('th', null, l)));
  tbl.appendChild(thead);
  iters.forEach(it => {
    const s = getScores(it);
    if (!s) return;
    const cells = dims.map(d => h('td', {className: 'score ' + scoreClass(s[d])}, fmt(s[d])));
    tbl.appendChild(h('tr', null, h('td', null, 'Iteration ' + it.iteration), ...cells));
  });
  if (iters.length >= 2) {
    const first = getScores(iters[0]);
    const last = getScores(iters[iters.length-1]);
    if (first && last) {
      const delta = last.overall - first.overall;
      const sign = delta >= 0 ? '+' : '';
      const cls = delta > 0 ? 'score-high' : delta < 0 ? 'score-low' : 'score-mid';
      tbl.appendChild(h('tr', null, h('td', null, h('strong', null, 'Change')),
        h('td', {className: 'score ' + cls}, sign + fmt(delta)),
        ...labels.slice(1).map(() => h('td'))
      ));
    }
  }
  wrapper.appendChild(tbl);
  return wrapper;
}

function renderScoreProgression() {
  const iters = DATA.iterations.filter(it => it.aggregatedScores || it.trainScores);
  if (iters.length === 0) return h('div', null, 'No scores yet.');
  const card = h('div', {className: 'card'});
  card.appendChild(h('h2', null, 'Score Progression'));
  const trainInfo = 'Train: even pages (' + DATA.trainPageNumbers.join(', ') + ') — used for improvements';
  const testInfo = 'Test: odd pages (' + DATA.testPageNumbers.join(', ') + ') — measures generalization';
  card.appendChild(h('div', {style: 'font-size:0.75rem;color:var(--text-muted);margin-bottom:12px'}, trainInfo));
  card.appendChild(h('div', {style: 'font-size:0.75rem;color:var(--text-muted);margin-bottom:12px'}, testInfo));
  card.appendChild(renderScoreTable('Test Scores (generalization)', iters, it => it.aggregatedScores));
  card.appendChild(renderScoreTable('Train Scores', iters, it => it.trainScores));
  return card;
}

function renderTreeNode(node, depth) {
  const wrapper = h('div', {className: depth > 0 ? 'tree-node' : ''});
  const label = h('span', {className: 'tree-label'}, node.structure || node.role || '(unknown)');
  if (node.text) {
    const text = node.text.length > 120 ? node.text.slice(0, 120) + '...' : node.text;
    wrapper.appendChild(h('div', null, label, ' ', h('span', {className: 'tree-text'}, text)));
  } else if (node.imageId) {
    wrapper.appendChild(h('div', null, label, ' ', h('span', {className: 'tree-image-ref'}, '[' + node.imageId + ']')));
  } else {
    wrapper.appendChild(h('div', null, label));
  }
  if (node.children) {
    node.children.forEach(child => wrapper.appendChild(renderTreeNode(child, depth + 1)));
  }
  return wrapper;
}

function renderPageDetail(page, pageResult, iteration) {
  const detail = h('div', {className: 'page-detail'});
  // Left: page image
  const left = h('div');
  left.appendChild(h('img', {className: 'page-image', src: 'data:image/png;base64,' + page.imageBase64, alt: 'Page ' + page.pageNumber}));
  if (pageResult.evaluation) {
    const ev = pageResult.evaluation;
    left.appendChild(h('div', {className: 'card', style: 'margin-top:12px'},
      h('h3', null, 'Scores'),
      renderBar('Overall', ev.overall_score),
      renderBar('Text Comp.', ev.scores.text_completeness),
      renderBar('Accuracy', ev.scores.text_accuracy),
      renderBar('Structure', ev.scores.tree_structure),
      renderBar('Types', ev.scores.type_accuracy),
      renderBar('Images', ev.scores.image_placement),
      renderBar('Order', ev.scores.reading_order)
    ));
    if (ev.issues.length > 0) {
      const issueList = h('div');
      ev.issues.forEach(iss => {
        const bcls = iss.severity === 'high' ? 'badge-high' : iss.severity === 'medium' ? 'badge-medium' : 'badge-low';
        issueList.appendChild(h('div', {className: 'issue'},
          h('span', {className: 'badge ' + bcls}, iss.severity), ' ',
          h('span', null, iss.category + ': ' + iss.description)
        ));
      });
      left.appendChild(h('div', {className: 'card', style: 'margin-top:12px'}, h('h3', null, 'Issues'), issueList));
    }
    if (ev.suggestions) {
      left.appendChild(h('div', {className: 'card', style: 'margin-top:12px'}, h('h3', null, 'Suggestions'), h('div', {style: 'font-size:0.8rem;color:var(--text-muted)'}, ev.suggestions)));
    }
  }
  detail.appendChild(left);

  // Right: structuring tree + raw JSON
  const right = h('div');
  if (pageResult.error) {
    right.appendChild(h('div', {className: 'card'}, h('div', {style: 'color:var(--red)'}, 'Error: ' + pageResult.error)));
  } else if (pageResult.structuringResult) {
    const sr = pageResult.structuringResult;
    right.appendChild(h('div', {className: 'card'},
      h('h3', null, 'Content Tree'),
      h('div', {style: 'font-size:0.8rem;color:var(--text-muted);margin-bottom:8px'}, sr.reasoning || ''),
      h('div', {className: 'tree-view'}, ...(sr.nodes || []).map(n => renderTreeNode(n, 0)))
    ));
    // Collapsible extracted text
    const ocrHeader = h('h3', {className: 'collapsible-header', onClick: function() {
      this.classList.toggle('open');
      this.nextElementSibling.classList.toggle('open');
    }}, 'Extracted Text');
    const ocrBody = h('pre', {className: 'collapsible-body'}, page.ocrText);
    right.appendChild(h('div', {className: 'card', style: 'margin-top:12px'}, ocrHeader, ocrBody));
    // Collapsible raw JSON
    const jsonHeader = h('h3', {className: 'collapsible-header', onClick: function() {
      this.classList.toggle('open');
      this.nextElementSibling.classList.toggle('open');
    }}, 'Raw JSON');
    const jsonBody = h('pre', {className: 'collapsible-body'}, JSON.stringify(sr, null, 2));
    right.appendChild(h('div', {className: 'card', style: 'margin-top:12px'}, jsonHeader, jsonBody));
  }
  detail.appendChild(right);
  return detail;
}

function renderIteration(iteration) {
  const section = h('div');
  // Aggregated scores bar chart
  if (iteration.aggregatedScores) {
    const s = iteration.aggregatedScores;
    section.appendChild(h('div', {className: 'card'},
      h('h2', null, 'Overall Scores'),
      renderBar('Overall', s.overall),
      renderBar('Text Comp.', s.text_completeness),
      renderBar('Accuracy', s.text_accuracy),
      renderBar('Structure', s.tree_structure),
      renderBar('Types', s.type_accuracy),
      renderBar('Images', s.image_placement),
      renderBar('Order', s.reading_order)
    ));
  }

  // Per-page results with sub-tabs
  const pageTabsContainer = h('div', {className: 'tabs'});
  const pageContents = h('div');
  iteration.pageResults.forEach((pr, idx) => {
    const page = DATA.pages.find(p => p.pageId === pr.pageId);
    if (!page) return;
    const scoreLabel = pr.evaluation ? ' (' + fmt(pr.evaluation.overall_score) + ')' : pr.error ? ' (err)' : '';
    const isTrain = DATA.trainPageNumbers.includes(page.pageNumber);
    const setLabel = isTrain ? ' [train]' : ' [test]';
    const tab = h('button', {
      className: 'tab' + (idx === 0 ? ' active' : ''),
      onClick: function() {
        pageTabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        pageContents.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        pageContents.querySelector('#page-' + iteration.iteration + '-' + idx).classList.add('active');
      }
    }, page.pageId + scoreLabel + setLabel);
    pageTabsContainer.appendChild(tab);
    const content = h('div', {className: 'tab-content' + (idx === 0 ? ' active' : ''), id: 'page-' + iteration.iteration + '-' + idx});
    content.appendChild(renderPageDetail(page, pr, iteration));
    pageContents.appendChild(content);
  });
  section.appendChild(h('div', {className: 'card'}, h('h2', null, 'Pages'), pageTabsContainer, pageContents));

  // Improvement plan
  if (iteration.improvementPlan) {
    const plan = iteration.improvementPlan;
    const planCard = h('div', {className: 'card'});
    planCard.appendChild(h('h2', null, 'Proposed Improvements'));
    planCard.appendChild(h('div', {style: 'font-size:0.85rem;margin-bottom:12px;color:var(--text-muted)'}, plan.reasoning));
    if (plan.description_changes.length > 0) {
      planCard.appendChild(h('h3', null, 'Description Changes'));
      plan.description_changes.forEach(ch => {
        planCard.appendChild(h('div', {className: 'change-modify', style: 'font-size:0.8rem;padding:2px 0'}, '~ ' + ch.category + '.' + ch.key + ': ' + ch.new_description));
      });
    }
    if (plan.prompt_changes.should_modify) {
      planCard.appendChild(h('h3', {style: 'margin-top:12px'}, 'Prompt Changes'));
      planCard.appendChild(h('div', {style: 'font-size:0.8rem;color:var(--text-muted)'}, plan.prompt_changes.change_summary));
    }
    section.appendChild(planCard);
  }

  // Config snapshot (collapsible)
  const configHeader = h('h2', {className: 'collapsible-header', onClick: function() {
    this.classList.toggle('open');
    this.nextElementSibling.classList.toggle('open');
  }}, 'Config Snapshot');
  const configBody = h('div', {className: 'collapsible-body'});
  const renderTypes = (label, types) => {
    const list = h('div', {style: 'margin-bottom:8px'});
    list.appendChild(h('h3', null, label));
    types.forEach(t => list.appendChild(h('div', {style: 'font-size:0.8rem;color:var(--text-muted)'}, t.key + ': ' + t.description)));
    return list;
  };
  configBody.appendChild(renderTypes('Text Types', iteration.config.textTypes));
  configBody.appendChild(renderTypes('Container Types', iteration.config.containerTypes));
  const promptHeader = h('h3', {className: 'collapsible-header', style: 'margin-top:8px', onClick: function() {
    this.classList.toggle('open');
    this.nextElementSibling.classList.toggle('open');
  }}, 'Prompt Template');
  configBody.appendChild(promptHeader);
  configBody.appendChild(h('pre', {className: 'collapsible-body'}, iteration.promptText));
  section.appendChild(h('div', {className: 'card'}, configHeader, configBody));

  return section;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Score progression
  app.appendChild(renderScoreProgression());

  // Iteration tabs
  const tabs = h('div', {className: 'tabs'});
  const contents = h('div');
  DATA.iterations.forEach((it, idx) => {
    const scoreLabel = it.aggregatedScores ? ' (' + fmt(it.aggregatedScores.overall) + ')' : '';
    const tab = h('button', {
      className: 'tab' + (idx === 0 ? ' active' : ''),
      onClick: function() {
        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        contents.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        contents.querySelector('#iter-' + it.iteration).classList.add('active');
      }
    }, 'Iteration ' + it.iteration + scoreLabel);
    tabs.appendChild(tab);
    const content = h('div', {className: 'tab-content' + (idx === 0 ? ' active' : ''), id: 'iter-' + it.iteration});
    content.appendChild(renderIteration(it));
    contents.appendChild(content);
  });

  app.appendChild(h('div', {style: 'margin-top:16px'}, tabs, contents));
}

render();
<\/script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
