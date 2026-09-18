(function () {
  "use strict";

  const WIDTH = 820;
  const CARD_X = 91;
  const CARD_WIDTH = 638;
  const FIRST_CARD_Y = 319;
  const CARD_GAP = 18;
  const BOTTOM_SPACE = 143;
  const CONTENT_X = 168;
  const LABEL_CONTENT_GAP = 10;
  const CONTENT_RIGHT_PADDING = 38;
  const TITLE_BODY_BASELINE_GAP = 38;
  const BODY_BASELINE_GAP = 30;
  const FONT_STACK = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  const STORAGE_KEY = "schedule-maker-draft-v1";
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const initialState = {
    title: "广州旅行计划🧳",
    dateRange: "5.1-5.5",
    description: "城市漫游・美食之旅🍜",
    rows: [
      row("5.1", "抵达广州🚄", "11:00", "到达广州南站", false),
      row("5.1", "抵达广州🚄", "12:00", "入住酒店，寄存行李", false),
      row("5.1", "抵达广州🚄", "下午", "沙面与永庆坊散步", false),
      row("5.2", "打卡广州塔🌆", "10:00-12:00", "正佳广场", true),
      row("5.2", "打卡广州塔🌆", "中午", "喝午茶", true),
      row("5.2", "打卡广州塔🌆", "下午", "广州塔", true),
      row("5.2", "打卡广州塔🌆", "18:00", "琶醍江边晚餐", true),
      row("5.3", "旧城区漫游🍜", "09:30-11:30", "兰圃", true),
      row("5.3", "旧城区漫游🍜", "中午", "西华路品尝地道小吃", true),
      row("5.3", "旧城区漫游🍜", "下午", "南越王博物馆", true),
      row("5.4", "长隆野生动物世界🐼", "", "", false),
      row("5.5", "返程🏠", "16:00", "前往广州南站", false),
      row("5.5", "返程🏠", "18:00", "乘高铁返程", false)
    ]
  };

  let state = loadSavedState();
  let zoom = 0.75;
  let renderFrame = 0;

  const els = {
    title: document.querySelector("#scheduleTitle"),
    range: document.querySelector("#dateRange"),
    description: document.querySelector("#scheduleDescription"),
    rows: document.querySelector("#scheduleRows"),
    addRow: document.querySelector("#addRow"),
    exportTable: document.querySelector("#exportTable"),
    clear: document.querySelector("#clearSchedule"),
    reset: document.querySelector("#resetExample"),
    canvas: document.querySelector("#scheduleCanvas"),
    shell: document.querySelector("#canvasShell"),
    previewSize: document.querySelector("#previewSize"),
    pasteInput: document.querySelector("#pasteInput"),
    parseRows: document.querySelector("#parseRows"),
    parseStatus: document.querySelector("#parseStatus"),
    excelFile: document.querySelector("#excelFile"),
    excelStatus: document.querySelector("#excelStatus"),
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

  function loadSavedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return clone(initialState);
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rows)) return clone(initialState);
      return {
        title: String(parsed.title ?? ""),
        dateRange: String(parsed.dateRange ?? ""),
        description: String(parsed.description ?? ""),
        rows: parsed.rows.map((item) => row(
          String(item?.date ?? ""),
          String(item?.title ?? ""),
          String(item?.label ?? ""),
          String(item?.content ?? ""),
          Boolean(item?.highlight)
        ))
      };
    } catch (_) {
      return clone(initialState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        title: state.title,
        dateRange: state.dateRange,
        description: state.description,
        rows: state.rows.map(({ date, title, label, content, highlight }) => ({ date, title, label, content, highlight }))
      }));
    } catch (_) {
      // The editor still works when browser storage is unavailable.
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getTableGroups(rows) {
    const groups = [];
    rows.forEach((item) => {
      const previous = groups[groups.length - 1];
      const hasIdentity = item.date.trim() || item.title.trim();
      const canMerge = hasIdentity && previous && previous.date === item.date && previous.title === item.title;
      if (canMerge) previous.items.push(item);
      else groups.push({ date: item.date, title: item.title, items: [item] });
    });
    return groups;
  }

  function renderTable() {
    const groupById = new Map();
    getTableGroups(state.rows).forEach((group) => {
      const ids = group.items.map((item) => item.id).join(",");
      group.items.forEach((item, position) => groupById.set(item.id, {
        ids,
        rowspan: group.items.length,
        isFirst: position === 0
      }));
    });

    els.rows.innerHTML = state.rows.map((item, index) => {
      const group = groupById.get(item.id);
      const mergedCells = group.isFirst ? `
        <td class="check-cell group-cell" rowspan="${group.rowspan}" data-group-ids="${group.ids}"><input type="checkbox" data-field="highlight" ${item.highlight ? "checked" : ""} aria-label="第 ${index + 1} 组设为重点日期" /></td>
        <td class="group-cell" rowspan="${group.rowspan}" data-group-ids="${group.ids}"><input type="text" data-field="date" value="${escapeHtml(item.date)}" aria-label="第 ${index + 1} 组日期" /></td>
        <td class="group-cell" rowspan="${group.rowspan}" data-group-ids="${group.ids}">
          <div class="group-title-control">
            <input type="text" data-field="title" value="${escapeHtml(item.title)}" aria-label="第 ${index + 1} 组卡片标题" />
            <button class="group-add-button" type="button" data-action="add-group-row" data-group-ids="${group.ids}" title="为此卡片增加一条内容" aria-label="为${escapeHtml(item.title || "此卡片")}增加一条内容">＋</button>
          </div>
        </td>
      ` : "";
      return `
      <tr data-id="${item.id}">
        ${mergedCells}
        <td><input type="text" data-field="label" value="${escapeHtml(item.label)}" aria-label="第 ${index + 1} 行时间或标签" /></td>
        <td><input type="text" data-field="content" value="${escapeHtml(item.content)}" aria-label="第 ${index + 1} 行内容" /></td>
        <td>
          <div class="row-actions">
            <button class="icon-button" type="button" data-action="up" title="上移" aria-label="上移第 ${index + 1} 行">↑</button>
            <button class="icon-button" type="button" data-action="down" title="下移" aria-label="下移第 ${index + 1} 行">↓</button>
            <button class="icon-button delete" type="button" data-action="delete" title="删除" aria-label="删除第 ${index + 1} 行">×</button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
  }

  function syncHeaderInputs() {
    els.title.value = state.title;
    els.range.value = state.dateRange;
    els.description.value = state.description;
  }

  function groupCards(rows) {
    const cards = [];
    rows.forEach((item) => {
      const sourceDate = item.date.trim();
      const sourceTitle = item.title.trim();
      const clean = {
        date: sourceDate || "—",
        title: sourceTitle || "未命名日程",
        label: item.label.trim(),
        content: item.content.trim(),
        highlight: !!item.highlight
      };
      const previous = cards[cards.length - 1];
      const hasIdentity = sourceDate || sourceTitle;
      const canMerge = hasIdentity && previous && previous.sourceDate === sourceDate && previous.sourceTitle === sourceTitle;
      const hasDetail = clean.label || clean.content;
      if (canMerge) {
        if (hasDetail) previous.details.push({ label: clean.label, content: clean.content });
        previous.summary = previous.details.length === 0;
      } else {
        cards.push({
          date: clean.date,
          title: clean.title,
          highlight: clean.highlight,
          summary: !hasDetail,
          details: hasDetail ? [{ label: clean.label, content: clean.content }] : [],
          sourceDate,
          sourceTitle
        });
      }
    });
    return cards.map(({ sourceDate, sourceTitle, ...card }) => card);
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
    const cards = groupCards(state.rows).map((card) => {
      if (card.summary) return { ...card, height: 130, lineCount: 1, details: [] };
      const details = card.details.map((detail) => {
        const labelWidth = measure.measureText(detail.label).width;
        const contentOffset = labelWidth ? labelWidth + LABEL_CONTENT_GAP : 0;
        const maxContentWidth = Math.max(40, CARD_WIDTH - CONTENT_X - contentOffset - CONTENT_RIGHT_PADDING);
        return {
          ...detail,
          contentOffset,
          wrapped: wrapText(measure, detail.content, maxContentWidth)
        };
      });
      const detailLineCount = details.reduce((sum, detail) => sum + Math.max(1, detail.wrapped.length), 0);
      const lineCount = 1 + detailLineCount;
      const contentHeight = 30 + TITLE_BODY_BASELINE_GAP + Math.max(0, detailLineCount - 1) * BODY_BASELINE_GAP;
      const height = lineCount <= 2 ? 130 : contentHeight + 60;
      return { ...card, details, lineCount, contentHeight, height };
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

  function drawBaselineText(ctx, text, x, baselineY, weight, size, color) {
    setFont(ctx, weight, size);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillText(text, x, baselineY);
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
      drawBaselineText(ctx, card.title, contentX, y + 76, 700, 26, "#000000");
      return;
    }
    const contentTop = y + (card.height - card.contentHeight) / 2;
    let baselineY = contentTop + 26;
    drawBaselineText(ctx, card.title, contentX, baselineY, 700, 26, "#000000");
    baselineY += TITLE_BODY_BASELINE_GAP;
    card.details.forEach((detail) => {
      const wrapped = detail.wrapped.length ? detail.wrapped : [""];
      wrapped.forEach((line, lineIndex) => {
        if (lineIndex === 0) drawBaselineText(ctx, detail.label, contentX, baselineY, 400, 20, "#343A46");
        drawBaselineText(ctx, line, contentX + detail.contentOffset, baselineY, 400, 20, "#000000");
        baselineY += BODY_BASELINE_GAP;
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

  function svgBaselineText(text, x, baselineY, weight, size, color) {
    return `<text x="${x}" y="${baselineY}" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI Emoji, Apple Color Emoji, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(text)}</text>`;
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
        parts.push(svgBaselineText(card.title, contentX, y + 76, 700, 26, "#000000"));
      } else {
        const contentTop = y + (card.height - card.contentHeight) / 2;
        let baselineY = contentTop + 26;
        parts.push(svgBaselineText(card.title, contentX, baselineY, 700, 26, "#000000"));
        baselineY += TITLE_BODY_BASELINE_GAP;
        card.details.forEach((detail) => {
          detail.wrapped.forEach((line, index) => {
            if (index === 0) parts.push(svgBaselineText(detail.label, contentX, baselineY, 400, 20, "#343A46"));
            parts.push(svgBaselineText(line, contentX + detail.contentOffset, baselineY, 400, 20, "#000000"));
            baselineY += BODY_BASELINE_GAP;
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

  function requireExcelLibrary() {
    if (!window.XLSX) throw new Error("Excel 组件未能加载，请确认 vendor 文件夹与 HTML 位于同一目录中。");
    return window.XLSX;
  }

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  }

  async function saveExcelWorkbook(XLSX, workbook) {
    const outputName = filename("xlsx");
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      compression: true
    });
    const excelFile = typeof File === "function"
      ? new File([bytes], outputName, { type: XLSX_MIME })
      : new Blob([bytes], { type: XLSX_MIME });

    if (
      isMobileDevice()
      && typeof File === "function"
      && excelFile instanceof File
      && typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [excelFile] })
    ) {
      try {
        await navigator.share({
          files: [excelFile],
          title: outputName
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    downloadBlob(excelFile, outputName);
  }

  async function exportTable() {
    try {
      const XLSX = requireExcelLibrary();
      const tableRows = state.rows.map((item) => ({
        "重点": item.highlight ? "是" : "否",
        "日期": item.date,
        "卡片标题": item.title,
        "时间/标签": item.label,
        "内容": item.content
      }));
      const tableSheet = XLSX.utils.json_to_sheet(tableRows, {
        header: ["重点", "日期", "卡片标题", "时间/标签", "内容"]
      });
      tableSheet["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 42 }];
      if (tableRows.length) tableSheet["!autofilter"] = { ref: `A1:E${tableRows.length + 1}` };

      const infoSheet = XLSX.utils.aoa_to_sheet([
        ["字段", "内容"],
        ["主标题", state.title],
        ["日期范围", state.dateRange],
        ["说明", state.description]
      ]);
      infoSheet["!cols"] = [{ wch: 12 }, { wch: 42 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, tableSheet, "日程表格");
      XLSX.utils.book_append_sheet(workbook, infoSheet, "基本信息");
      await saveExcelWorkbook(XLSX, workbook);
    } catch (error) {
      window.alert(error.message || "导出 Excel 失败，请重试。");
    }
  }

  function normalizeExcelHeader(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s/_-]+/g, "");
  }

  function findExcelColumns(matrix) {
    const aliases = {
      highlight: new Set(["重点", "是否重点", "重点日期", "highlight"]),
      date: new Set(["日期", "date"]),
      title: new Set(["卡片标题", "标题", "cardtitle"]),
      label: new Set(["时间标签", "时间或标签", "时间", "标签", "label", "time"]),
      content: new Set(["内容", "日程内容", "事项", "content"])
    };
    const limit = Math.min(matrix.length, 12);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
      const columns = { highlight: -1, date: -1, title: -1, label: -1, content: -1 };
      matrix[rowIndex].forEach((cell, columnIndex) => {
        const header = normalizeExcelHeader(cell);
        Object.entries(aliases).forEach(([key, names]) => {
          if (columns[key] < 0 && names.has(header)) columns[key] = columnIndex;
        });
      });
      if (columns.date >= 0 && columns.title >= 0 && columns.content >= 0) return { rowIndex, columns };
    }
    throw new Error("未找到可识别的表头，请至少包含：日期、卡片标题、内容。");
  }

  function parseExcelHighlight(value) {
    if (typeof value === "boolean") return value;
    return /^(1|true|yes|是|重点|√|✓)$/i.test(String(value ?? "").trim());
  }

  function cellText(rowValues, index) {
    return index >= 0 ? String(rowValues[index] ?? "").trim() : "";
  }

  function readExcelRows(matrix, header) {
    const imported = [];
    let inheritedDate = "";
    let inheritedTitle = "";
    let inheritedHighlight = false;
    matrix.slice(header.rowIndex + 1).forEach((rowValues) => {
      const rawDate = cellText(rowValues, header.columns.date);
      const rawTitle = cellText(rowValues, header.columns.title);
      const label = cellText(rowValues, header.columns.label);
      const content = cellText(rowValues, header.columns.content);
      const rawHighlight = cellText(rowValues, header.columns.highlight);
      if (!rawDate && !rawTitle && !label && !content && !rawHighlight) return;

      if (rawDate) inheritedDate = rawDate;
      if (rawTitle) inheritedTitle = rawTitle;
      if (rawHighlight) inheritedHighlight = parseExcelHighlight(rawHighlight);
      else if (rawDate || rawTitle) inheritedHighlight = false;
      imported.push(row(
        rawDate || inheritedDate,
        rawTitle || inheritedTitle,
        label,
        content,
        rawHighlight ? parseExcelHighlight(rawHighlight) : inheritedHighlight
      ));
    });
    if (!imported.length) throw new Error("Excel 中没有可导入的日程内容。");
    return imported;
  }

  function readExcelInfo(workbook, XLSX) {
    const sheet = workbook.Sheets["基本信息"];
    if (!sheet) return null;
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const values = new Map(matrix.slice(1).map((entry) => [String(entry[0] ?? "").trim(), String(entry[1] ?? "")]));
    return {
      title: values.get("主标题"),
      dateRange: values.get("日期范围"),
      description: values.get("说明")
    };
  }

  async function importExcelFile(file) {
    const XLSX = requireExcelLibrary();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Excel 文件中没有工作表。");
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1, defval: "", raw: false });
    const header = findExcelColumns(matrix);
    state.rows = readExcelRows(matrix, header);

    const info = readExcelInfo(workbook, XLSX);
    if (info) {
      if (info.title !== undefined) state.title = info.title;
      if (info.dateRange !== undefined) state.dateRange = info.dateRange;
      if (info.description !== undefined) state.description = info.description;
    }
    saveState();
    syncHeaderInputs();
    renderTable();
    scheduleRender();
    return state.rows.length;
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
    saveState();
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
    saveState();
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

  els.title.addEventListener("input", () => { state.title = els.title.value; saveState(); scheduleRender(); });
  els.range.addEventListener("input", () => { state.dateRange = els.range.value; saveState(); scheduleRender(); });
  els.description.addEventListener("input", () => { state.description = els.description.value; saveState(); scheduleRender(); });

  els.rows.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const tr = event.target.closest("tr");
    if (!field || !tr) return;
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    const groupIds = event.target.closest("[data-group-ids]")?.dataset.groupIds.split(",");
    if (groupIds && ["date", "title", "highlight"].includes(field)) {
      state.rows.forEach((item) => {
        if (groupIds.includes(item.id)) item[field] = value;
      });
    } else {
      const item = state.rows.find((entry) => entry.id === tr.dataset.id);
      if (!item) return;
      item[field] = value;
    }
    saveState();
    scheduleRender();
  });

  els.rows.addEventListener("change", (event) => {
    if (["date", "title", "highlight"].includes(event.target.dataset.field)) renderTable();
  });

  els.rows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    const tr = event.target.closest("tr");
    if (!button || !tr) return;
    const index = state.rows.findIndex((entry) => entry.id === tr.dataset.id);
    if (index < 0) return;
    const action = button.dataset.action;
    if (action === "add-group-row") {
      const groupIds = button.dataset.groupIds.split(",");
      const lastIndex = state.rows.reduce((result, item, itemIndex) => groupIds.includes(item.id) ? itemIndex : result, index);
      const source = state.rows[lastIndex];
      const added = row(source.date, source.title, "", "", source.highlight);
      state.rows.splice(lastIndex + 1, 0, added);
      saveState();
      renderTable();
      scheduleRender();
      requestAnimationFrame(() => els.rows.querySelector(`tr[data-id="${added.id}"] [data-field="label"]`)?.focus());
      return;
    }
    if (action === "delete") state.rows.splice(index, 1);
    if (action === "up" && index > 0) [state.rows[index - 1], state.rows[index]] = [state.rows[index], state.rows[index - 1]];
    if (action === "down" && index < state.rows.length - 1) [state.rows[index + 1], state.rows[index]] = [state.rows[index], state.rows[index + 1]];
    saveState();
    renderTable();
    scheduleRender();
  });

  els.addRow.addEventListener("click", () => {
    const added = row("", "", "", "", false);
    state.rows.push(added);
    saveState();
    renderTable();
    scheduleRender();
    requestAnimationFrame(() => {
      els.rows.querySelector(`tr[data-id="${added.id}"] [data-field="date"]`)?.focus();
    });
  });

  els.clear.addEventListener("click", () => {
    state = { title: "", dateRange: "", description: "", rows: [row("", "", "", "", false)] };
    saveState();
    syncHeaderInputs();
    renderTable();
    scheduleRender();
    requestAnimationFrame(() => els.title.focus());
  });

  els.reset.addEventListener("click", () => {
    state = clone(initialState);
    state.rows = state.rows.map((item) => ({ ...item, id: uid() }));
    saveState();
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
  els.exportTable.addEventListener("click", exportTable);
  els.excelFile.addEventListener("change", async () => {
    const file = els.excelFile.files?.[0];
    if (!file) return;
    els.excelStatus.textContent = "正在导入…";
    try {
      const count = await importExcelFile(file);
      els.excelStatus.textContent = `已从 ${file.name} 导入 ${count} 行。`;
    } catch (error) {
      els.excelStatus.textContent = error.message || "导入失败，请检查表格格式。";
    } finally {
      els.excelFile.value = "";
    }
  });
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
