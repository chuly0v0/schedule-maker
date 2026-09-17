(function () {
  "use strict";

  const WIDTH = 820;
  const CARD_X = 91;
  const CARD_WIDTH = 638;
  const FIRST_CARD_Y = 319;
  const CARD_GAP = 18;
  const BOTTOM_SPACE = 143;
  const CONTENT_X = 168;
  const LABEL_WIDTH = 60;
  const LABEL_GAP = 10;
  const CONTENT_RIGHT_PADDING = 38;
  const FONT_STACK = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

  const initialState = {
    title: "国庆日程😊",
    dateRange: "9.28—10.7",
    description: "嘉宜&毛sin婚礼💐",
    rows: [
      row("9.28", "嘉宜结婚👰", "13:30", "嘉宜开始化妆💄", true),
      row("9.28", "嘉宜结婚👰", "15:00", "到嘉宜家🚗", true),
      row("9.28", "嘉宜结婚👰", "晚上", "渔人码头吃席🍚", true),
      row("10.1", "毛sin结婚👰", "09:00", "毛sin 家🏠", true),
      row("10.1", "毛sin结婚👰", "中午", "吃席🍚", true),
      row("10.1", "毛sin结婚👰", "随后", "接亲👰", true),
      row("10.1", "毛sin结婚👰", "晚上", "男方家吃席🍚", true),
      row("10.3", "广州-南宁🚗", "09:30", "出发去南宁，住一晚", false),
      row("10.3", "广州-南宁🚗", "同行", "嘉宜、老王、chuly、胡同学", false),
      row("10.4", "南宁-曲靖🚗", "09:30", "南宁出发去曲靖", false),
      row("10.4", "南宁-曲靖🚗", "抵达后", "休整，可能开始布置", false),
      row("10.5", "全天  婚礼布置💐", "", "", false),
      row("10.6", "嘉宜婚礼👰", "09:00", "🚗出门（时间沟通中）", true),
      row("10.6", "嘉宜婚礼👰", "流程", "接亲、吃席、玩、拍照、吃席", true),
      row("10.7", "回程✈️", "早上", "机场", false)
    ]
  };

  let state = clone(initialState);
  let zoom = 0.75;
  let renderFrame = 0;

  const els = {
    title: document.querySelector("#scheduleTitle"),
    range: document.querySelector("#dateRange"),
    description: document.querySelector("#scheduleDescription"),
    rows: document.querySelector("#scheduleRows"),
    addRow: document.querySelector("#addRow"),
    reset: document.querySelector("#resetExample"),
    canvas: document.querySelector("#scheduleCanvas"),
    shell: document.querySelector("#canvasShell"),
    previewSize: document.querySelector("#previewSize"),
    pasteInput: document.querySelector("#pasteInput"),
    parseRows: document.querySelector("#parseRows"),
    parseStatus: document.querySelector("#parseStatus"),
    downloadPng: document.querySelector("#downloadPng"),
    downloadPng2x: document.querySelector("#downloadPng2x"),
    downloadSvg: document.querySelector("#downloadSvg")
  };

  function uid() {
    return "r_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function row(date, title, label, content, highlight) {
    return { id: uid(), date, title, label, content, highlight: !!highlight };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderTable() {
    els.rows.innerHTML = state.rows.map((item, index) => `
      <tr data-id="${item.id}">
        <td><input type="text" data-field="date" value="${escapeHtml(item.date)}" aria-label="第 ${index + 1} 行日期" /></td>
        <td><input type="text" data-field="title" value="${escapeHtml(item.title)}" aria-label="第 ${index + 1} 行卡片标题" /></td>
        <td><input type="text" data-field="label" value="${escapeHtml(item.label)}" aria-label="第 ${index + 1} 行时间或标签" /></td>
        <td><input type="text" data-field="content" value="${escapeHtml(item.content)}" aria-label="第 ${index + 1} 行内容" /></td>
        <td class="check-cell"><input type="checkbox" data-field="highlight" ${item.highlight ? "checked" : ""} aria-label="第 ${index + 1} 行设为重点日期" /></td>
        <td>
          <div class="row-actions">
            <button class="icon-button" type="button" data-action="up" title="上移" aria-label="上移第 ${index + 1} 行">↑</button>
            <button class="icon-button" type="button" data-action="down" title="下移" aria-label="下移第 ${index + 1} 行">↓</button>
            <button class="icon-button delete" type="button" data-action="delete" title="删除" aria-label="删除第 ${index + 1} 行">×</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function syncHeaderInputs() {
    els.title.value = state.title;
    els.range.value = state.dateRange;
    els.description.value = state.description;
  }

  function groupCards(rows) {
    const cards = [];
    rows.forEach((item) => {
      const clean = {
        date: item.date.trim() || "—",
        title: item.title.trim() || "未命名日程",
        label: item.label.trim(),
        content: item.content.trim(),
        highlight: !!item.highlight,
        summary: !item.label.trim() && !item.content.trim()
      };
      if (clean.summary) {
        cards.push({ ...clean, details: [] });
        return;
      }
      const previous = cards[cards.length - 1];
      const canMerge = previous && !previous.summary && previous.date === clean.date && previous.title === clean.title && previous.highlight === clean.highlight;
      const detail = { label: clean.label, content: clean.content };
      if (canMerge) previous.details.push(detail);
      else cards.push({ date: clean.date, title: clean.title, highlight: clean.highlight, summary: false, details: [detail] });
    });
    return cards;
  }

  function createMeasureContext(scale) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.scale(scale || 1, scale || 1);
    return ctx;
  }

  function setFont(ctx, weight, size) {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  }

  function wrapText(ctx, value, maxWidth) {
    const text = String(value || "");
    if (!text) return [""];
    const lines = [];
    let current = "";
    for (const char of Array.from(text)) {
      const test = current + char;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current || !lines.length) lines.push(current);
    return lines;
  }

  function buildLayout() {
    const measure = createMeasureContext(1);
    setFont(measure, 400, 20);
    const maxContentWidth = CARD_WIDTH - CONTENT_X - LABEL_WIDTH - LABEL_GAP - CONTENT_RIGHT_PADDING;
    const cards = groupCards(state.rows).map((card) => {
      if (card.summary) return { ...card, height: 130, lineCount: 1, details: [] };
      const details = card.details.map((detail) => ({
        ...detail,
        wrapped: wrapText(measure, detail.content, maxContentWidth)
      }));
      const lineCount = 1 + details.reduce((sum, detail) => sum + Math.max(1, detail.wrapped.length), 0);
      const height = lineCount <= 2 ? 130 : 60 + lineCount * 30;
      return { ...card, details, lineCount, height };
    });
    const cardsHeight = cards.reduce((sum, card) => sum + card.height, 0);
    const height = FIRST_CARD_Y + cardsHeight + Math.max(0, cards.length - 1) * CARD_GAP + BOTTOM_SPACE;
    return { width: WIDTH, height: Math.max(620, height), cards };
  }

  function roundedRect(ctx, x, y, width, height, radius, fill) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawText(ctx, text, x, y, weight, size, color, align) {
    setFont(ctx, weight, size);
    ctx.textBaseline = "top";
    ctx.textAlign = align || "left";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function renderDate(ctx, card, x, y) {
    const dateCenterX = x + 80;
    if (card.highlight) {
      roundedRect(ctx, x + 40, y + (card.height - 50) / 2, 80, 50, 12, "#FFE400");
      setFont(ctx, 700, 32);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000000";
      ctx.fillText(card.date, dateCenterX, y + card.height / 2 + 1);
    } else {
      const dateTop = y + (card.height - 42) / 2;
      drawText(ctx, card.date, dateCenterX, dateTop, 700, 32, "#000000", "center");
      ctx.fillStyle = "#0080FF";
      ctx.fillRect(x + 56, dateTop + 48, 48, 6);
    }
  }

  function renderCard(ctx, card, y) {
    roundedRect(ctx, CARD_X, y, CARD_WIDTH, card.height, 16, "#F4F4F4");
    renderDate(ctx, card, CARD_X, y);
    const contentX = CARD_X + CONTENT_X;
    if (card.summary) {
      drawText(ctx, card.title, contentX, y + 50, 700, 26, "#000000");
      return;
    }
    const contentHeight = card.lineCount * 30;
    let lineY = y + (card.lineCount >= 3 ? 30 : (card.height - contentHeight) / 2);
    drawText(ctx, card.title, contentX, lineY, 700, 26, "#000000");
    lineY += 30;
    card.details.forEach((detail) => {
      const wrapped = detail.wrapped.length ? detail.wrapped : [""];
      wrapped.forEach((line, lineIndex) => {
        if (lineIndex === 0) drawText(ctx, detail.label, contentX, lineY, 400, 20, "#343A46");
        drawText(ctx, line, contentX + LABEL_WIDTH + LABEL_GAP, lineY, 400, 20, "#000000");
        lineY += 30;
      });
    });
  }

  function paintCanvas(canvas, layout, pixelRatio) {
    const ratio = pixelRatio || 1;
    canvas.width = layout.width * ratio;
    canvas.height = layout.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, layout.width, layout.height);
    drawText(ctx, state.title || "未命名日程", 131, 164, 700, 50, "#000000");
    const subtitle = [state.dateRange.trim(), state.description.trim()].filter(Boolean).join("｜");
    drawText(ctx, subtitle, 131, 232, 500, 28, "#000000");
    let y = FIRST_CARD_Y;
    layout.cards.forEach((card) => {
      renderCard(ctx, card, y);
      y += card.height + CARD_GAP;
    });
    return canvas;
  }

  function scheduleRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderPreview);
  }

  function renderPreview() {
    const layout = buildLayout();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    paintCanvas(els.canvas, layout, ratio);
    els.canvas.style.width = `${layout.width * zoom}px`;
    els.canvas.style.height = `${layout.height * zoom}px`;
    els.shell.style.width = `${layout.width * zoom}px`;
    els.shell.style.height = `${layout.height * zoom}px`;
    els.previewSize.textContent = `${layout.width} × ${layout.height} px`;
  }

  function svgText(text, x, y, weight, size, color, anchor) {
    return `<text x="${x}" y="${y}" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI Emoji, Apple Color Emoji, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" dominant-baseline="text-before-edge"${anchor ? ` text-anchor="${anchor}"` : ""}>${escapeXml(text)}</text>`;
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function buildSvg(layout) {
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
      `<rect width="${layout.width}" height="${layout.height}" fill="#FFFFFF"/>`,
      svgText(state.title || "未命名日程", 131, 164, 700, 50, "#000000"),
      svgText([state.dateRange.trim(), state.description.trim()].filter(Boolean).join("｜"), 131, 232, 500, 28, "#000000")
    ];
    let y = FIRST_CARD_Y;
    layout.cards.forEach((card) => {
      parts.push(`<rect x="${CARD_X}" y="${y}" width="${CARD_WIDTH}" height="${card.height}" rx="16" fill="#F4F4F4"/>`);
      const centerX = CARD_X + 80;
      if (card.highlight) {
        parts.push(`<rect x="${CARD_X + 40}" y="${y + (card.height - 50) / 2}" width="80" height="50" rx="12" fill="#FFE400"/>`);
        parts.push(`<text x="${centerX}" y="${y + card.height / 2 + 2}" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif" font-size="32" font-weight="700" fill="#000000" dominant-baseline="middle" text-anchor="middle">${escapeXml(card.date)}</text>`);
      } else {
        const dateTop = y + (card.height - 42) / 2;
        parts.push(svgText(card.date, centerX, dateTop, 700, 32, "#000000", "middle"));
        parts.push(`<rect x="${CARD_X + 56}" y="${dateTop + 48}" width="48" height="6" fill="#0080FF"/>`);
      }
      const contentX = CARD_X + CONTENT_X;
      if (card.summary) {
        parts.push(svgText(card.title, contentX, y + 50, 700, 26, "#000000"));
      } else {
        const contentHeight = card.lineCount * 30;
        let lineY = y + (card.lineCount >= 3 ? 30 : (card.height - contentHeight) / 2);
        parts.push(svgText(card.title, contentX, lineY, 700, 26, "#000000"));
        lineY += 30;
        card.details.forEach((detail) => {
          detail.wrapped.forEach((line, index) => {
            if (index === 0) parts.push(svgText(detail.label, contentX, lineY, 400, 20, "#343A46"));
            parts.push(svgText(line, contentX + LABEL_WIDTH + LABEL_GAP, lineY, 400, 20, "#000000"));
            lineY += 30;
          });
        });
      }
      y += card.height + CARD_GAP;
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filename(ext) {
    const base = (state.title || "日程长图").replace(/[\\/:*?"<>|]/g, "-").trim() || "日程长图";
    return `${base}.${ext}`;
  }

  function exportPng(scale) {
    const layout = buildLayout();
    const canvas = document.createElement("canvas");
    paintCanvas(canvas, layout, scale);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename("png"));
    }, "image/png");
  }

  function parsePastedRows() {
    const lines = els.pasteInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = [];
    lines.forEach((line) => {
      const columns = line.split(/\t|[｜|]/).map((value) => value.trim());
      if (columns.length < 4) return;
      const flags = columns.slice(4).join(" ");
      parsed.push(row(columns[0], columns[1], columns[2], columns[3], /重点|是|yes/i.test(flags)));
    });
    if (!parsed.length) {
      els.parseStatus.textContent = "没有识别到有效行，请按示例使用竖线或制表符分隔。";
      return;
    }
    state.rows = parsed;
    renderTable();
    scheduleRender();
    els.parseStatus.textContent = `已导入 ${parsed.length} 行。`;
  }

  function replaceSchedule(input) {
    if (!input || typeof input !== "object" || !Array.isArray(input.rows) || input.rows.length === 0) {
      throw new Error("rows 必须是非空数组");
    }
    const normalizedRows = input.rows.map((item, index) => {
      if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 行格式无效`);
      return row(
        String(item.date || ""),
        String(item.title || ""),
        String(item.label || ""),
        String(item.content || ""),
        Boolean(item.highlight)
      );
    });
    state.title = String(input.title || "未命名日程");
    state.dateRange = String(input.dateRange || "");
    state.description = String(input.description || "");
    state.rows = normalizedRows;
    syncHeaderInputs();
    renderTable();
    renderPreview();
    return { rowCount: state.rows.length, cardCount: buildLayout().cards.length };
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        dateRange: { type: "string" },
        description: { type: "string" },
        rows: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              title: { type: "string" },
              label: { type: "string" },
              content: { type: "string" },
              highlight: { type: "boolean" }
            },
            required: ["date", "title", "label", "content"],
            additionalProperties: false
          }
        }
      },
      required: ["title", "dateRange", "description", "rows"],
      additionalProperties: false
    };
    try {
      void Promise.resolve(context.registerTool({
        name: "replace_schedule",
        title: "替换日程数据",
        description: "用结构化表格数据替换当前日程，并立即更新右侧长图预览。",
        inputSchema: schema,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          return replaceSchedule(input);
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (_) {
      // WebMCP is optional and unsupported browsers keep the normal UI flow.
    }
  }

  els.title.addEventListener("input", () => { state.title = els.title.value; scheduleRender(); });
  els.range.addEventListener("input", () => { state.dateRange = els.range.value; scheduleRender(); });
  els.description.addEventListener("input", () => { state.description = els.description.value; scheduleRender(); });

  els.rows.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const tr = event.target.closest("tr");
    if (!field || !tr) return;
    const item = state.rows.find((entry) => entry.id === tr.dataset.id);
    if (!item) return;
    item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    scheduleRender();
  });

  els.rows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    const tr = event.target.closest("tr");
    if (!button || !tr) return;
    const index = state.rows.findIndex((entry) => entry.id === tr.dataset.id);
    if (index < 0) return;
    const action = button.dataset.action;
    if (action === "delete") state.rows.splice(index, 1);
    if (action === "up" && index > 0) [state.rows[index - 1], state.rows[index]] = [state.rows[index], state.rows[index - 1]];
    if (action === "down" && index < state.rows.length - 1) [state.rows[index + 1], state.rows[index]] = [state.rows[index], state.rows[index + 1]];
    renderTable();
    scheduleRender();
  });

  els.addRow.addEventListener("click", () => {
    const previous = state.rows[state.rows.length - 1];
    state.rows.push(row(previous?.date || "", previous?.title || "", "", "", previous?.highlight || false));
    renderTable();
    scheduleRender();
    requestAnimationFrame(() => {
      const lastInput = els.rows.querySelector("tr:last-child input");
      lastInput?.focus();
    });
  });

  els.reset.addEventListener("click", () => {
    state = clone(initialState);
    state.rows = state.rows.map((item) => ({ ...item, id: uid() }));
    syncHeaderInputs();
    renderTable();
    scheduleRender();
  });

  document.querySelectorAll("[data-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      zoom = Number(button.dataset.zoom);
      document.querySelectorAll("[data-zoom]").forEach((item) => item.classList.toggle("active", item === button));
      scheduleRender();
    });
  });

  els.parseRows.addEventListener("click", parsePastedRows);
  els.downloadPng.addEventListener("click", () => exportPng(1));
  els.downloadPng2x.addEventListener("click", () => exportPng(2));
  els.downloadSvg.addEventListener("click", () => {
    const svg = buildSvg(buildLayout());
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename("svg"));
  });

  window.addEventListener("resize", scheduleRender);
  if (document.fonts?.ready) document.fonts.ready.then(scheduleRender);

  syncHeaderInputs();
  renderTable();
  renderPreview();
  registerWebMcpTools();
})();
