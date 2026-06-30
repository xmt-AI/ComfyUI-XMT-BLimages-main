import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const XMT_TEXT_COLOR = "#fff";
const PREVIEW_MIN_CELL = 96;
const PREVIEW_GAP = 6;
const PREVIEW_MAX_VISIBLE_ROWS = 2;
const NODE_SELECT_SWITCH_SIZE = [310, 205];
const NODE_SELECT_SWITCH_WIDGET_HEIGHT = 118;
const EXTERNAL_UPLOAD_SIZE = [320, 260];

function getWidgetByName(node, name) { 
    return node?.widgets?.find((w) => w.name === name); 
}

function getImageListWidget(node) {
    return getWidgetByName(node, "image_list");
}

function getExternalImageWidget(node) {
    return getWidgetByName(node, "image");
}

function isBatchLoadImagesNode(node) {
    return node?.comfyClass === "ComfyUI_xmt_BLImages" || node?.comfyClass === "BatchLoadImages" || node?.type === "ComfyUI_xmt_BLImages" || node?.type === "BatchLoadImages";
}

function clampInt(v, min, max) {
    v = Math.floor(Number(v));
    if (Number.isNaN(v)) v = min;
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
}

function buildVNCCSPrompt(data) {
    const azimuth = clampInt(data?.azimuth ?? 0, 0, 360) % 360;
    const elevation = clampInt(data?.elevation ?? 0, -30, 60);
    const distance = data?.distance ?? "medium shot";
    const include_trigger = data?.include_trigger !== false;

    const azimuthMap = {
        0: "front view", 45: "front-right quarter view", 90: "right side view",
        135: "back-right quarter view", 180: "back view", 225: "back-left quarter view",
        270: "left side view", 315: "front-left quarter view",
    };

    const closestAzimuth = azimuth > 337.5 ? 0 : Object.keys(azimuthMap).map(Number).reduce((best, k) => Math.abs(k - azimuth) < Math.abs(best - azimuth) ? k : best, 0);

    const elevationMap = {
        "-30": "low-angle shot", "0": "eye-level shot", "30": "elevated shot", "60": "high-angle shot",
    };

    const closestElevation = Object.keys(elevationMap).map(Number).reduce((best, k) => Math.abs(k - elevation) < Math.abs(best - elevation) ? k : best, 0);

    const parts = [];
    if (include_trigger) parts.push("<sks>");
    parts.push(azimuthMap[closestAzimuth]);
    parts.push(elevationMap[String(closestElevation)]);
    parts.push(distance);
    return parts.join(" ");
}

// 馃挕 缁堟瀬淇锛氬幓鎺変簡闂ジ鐨?splice 鎺掑簭閫昏緫锛屽彧鍋氬畨鍏ㄧ殑灏哄鎶垫秷鍜岀墿鐞嗛殣韬?
function neutralizeWidget(w) {
    if (!w) return;
    w.type = "hidden";
    w.hidden = true;
    w.computeSize = () => [0, -4]; // 瀹岀編鎶垫秷 LiteGraph 寮哄埗鍔犱笂鐨?4px 闂磋窛缂濋殭
    w.draw = () => {}; // 闃绘鐢诲竷寮曟搸鐢诲嚭鐧界偣
    
    const killDOM = () => {
        if (w.element) {
            w.element.style.setProperty('display', 'none', 'important');
            w.element.style.setProperty('pointer-events', 'none', 'important');
            w.element.style.setProperty('position', 'absolute', 'important');
            w.element.style.setProperty('width', '0px', 'important');
            w.element.style.setProperty('height', '0px', 'important');
        }
        if (w.inputEl) {
            w.inputEl.disabled = true; // 褰诲簳鍓ュず鍙偣鍑诲睘鎬э紝鏉滅粷鍑虹幇鐧芥鍏夌幆
            w.inputEl.style.setProperty('display', 'none', 'important');
        }
    };
    
    killDOM();
    setTimeout(killDOM, 50);
    setTimeout(killDOM, 200);
}

function applyNodeTextColor(node) {
    if (!node) return;
    node.title_text_color = XMT_TEXT_COLOR;
}

function createVNCCSVisualUI(node) {
    const w = getWidgetByName(node, "camera_data");
    neutralizeWidget(w);

    const container = document.createElement("div");
    container.style.cssText = `width:100%;padding:8px;background:var(--comfy-menu-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:6px;margin:5px 0;pointer-events:auto;`;

    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;";

    const mkField = (labelText) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";
        const label = document.createElement("div");
        label.textContent = labelText;
        label.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};opacity:0.9;`;
        wrap.appendChild(label);
        return { wrap };
    };

    const azF = mkField("水平角度");
    const elF = mkField("垂直角度");
    const distF = mkField("距离");
    const trigF = mkField("触发词");

    const az = document.createElement("input"); az.type = "range"; az.min = "0"; az.max = "360"; az.step = "45";
    const el = document.createElement("input"); el.type = "range"; el.min = "-30"; el.max = "60"; el.step = "30";

    const dist = document.createElement("select");
    ["close-up", "medium shot", "wide shot"].forEach(v => {
        const opt = document.createElement("option"); opt.value = v; opt.textContent = v; dist.appendChild(opt);
    });

    const trig = document.createElement("input"); trig.type = "checkbox";

    const azVal = document.createElement("div"); azVal.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};opacity:0.8;`;
    const elVal = document.createElement("div"); elVal.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};opacity:0.8;`;

    const promptOut = document.createElement("input"); promptOut.type = "text"; promptOut.readOnly = true;
    promptOut.style.cssText = `width:100%;padding:8px;background:var(--comfy-input-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:4px;`;

    azF.wrap.append(az, azVal); elF.wrap.append(el, elVal); distF.wrap.appendChild(dist); trigF.wrap.appendChild(trig);
    row.append(azF.wrap, elF.wrap, distF.wrap, trigF.wrap);

    const write = () => {
        const data = { azimuth: clampInt(az.value, 0, 360), elevation: clampInt(el.value, -30, 60), distance: dist.value, include_trigger: !!trig.checked };
        w.value = JSON.stringify(data); w.callback?.(w.value);
        azVal.textContent = String(data.azimuth); elVal.textContent = String(data.elevation);
        promptOut.value = buildVNCCSPrompt(data);
    };

    const read = () => {
        let data; try { data = JSON.parse(w.value || "{}"); } catch { data = {}; }
        az.value = String(clampInt(data?.azimuth ?? 0, 0, 360));
        el.value = String(clampInt(data?.elevation ?? 0, -30, 60));
        dist.value = data?.distance ?? "medium shot";
        trig.checked = data?.include_trigger !== false;
        write();
    };

    az.addEventListener("input", write); el.addEventListener("input", write);
    dist.addEventListener("change", write); trig.addEventListener("change", write);

    container.append(row, promptOut);
    return { container, read };
}

function parseImageList(text) { return (text || "").split("\n").map((s) => s.trim()).filter(Boolean); }

function setImageList(node, names) {
    const w = getImageListWidget(node);
    if (!w) return;
    w.value = (names || []).join("\n");
    w.callback?.(w.value);
}

function getMaxImagesValue(node) {
    const w = node?.widgets?.find((x) => x.name === "max_images");
    return typeof w?.value === "number" ? w.value : 0;
}

function deepClone(obj) { return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }

async function queueCurrent(node) { await api.queuePrompt(-1, await app.graphToPrompt()); }

function setPromptBatchNodeToSingleImage(prompt, node, name, index = 0) {
    const nodeId = String(node.id);
    const apiNode = prompt.output?.[nodeId];
    if (!apiNode) return false;

    apiNode.inputs = apiNode.inputs || {};
    apiNode.inputs.image_list = name;
    apiNode.inputs.mode = "single";
    apiNode.inputs.index = index;
    delete apiNode.inputs.append;
    delete apiNode.inputs.control;
    return true;
}

async function queueAllSequential(node) {
    const names0 = parseImageList(getImageListWidget(node)?.value);
    if (!names0?.length) return;

    const maxImages = getMaxImagesValue(node);
    const names = maxImages > 0 ? names0.slice(0, maxImages) : names0;
    if (!names.length) return;

    const basePrompt = await app.graphToPrompt();
    for (let i = 0; i < names.length; i++) {
        const prompt = deepClone(basePrompt);
        if (!setPromptBatchNodeToSingleImage(prompt, node, names[i], 0)) continue;
        await api.queuePrompt(-1, prompt);
    }
}

async function queueFirstImage(node) {
    const firstName = parseImageList(getImageListWidget(node)?.value)[0] || "";
    if (!firstName) return;

    const basePrompt = await app.graphToPrompt();
    const prompt = deepClone(basePrompt);
    setPromptBatchNodeToSingleImage(prompt, node, firstName, 0);
    await api.queuePrompt(-1, prompt);
}

function getControlActionForBatchNode(node) {
    const controlInput = node?.inputs?.find((input) => input?.name === "control");
    const linkId = controlInput?.link;
    if (linkId == null) return null;

    const link = app.graph?.links?.[linkId];
    const sourceNode = link ? app.graph.getNodeById(link.origin_id) : null;
    if (!sourceNode || (sourceNode.comfyClass !== "ComfyUI_xmt_NodeSelectSwitch" && sourceNode.type !== "ComfyUI_xmt_NodeSelectSwitch" && sourceNode.comfyClass !== "NodeSelectSwitch" && sourceNode.type !== "NodeSelectSwitch")) return null;

    const buttonWidget = getWidgetByName(sourceNode, "button");
    return buttonWidget?.value || null;
}

function getQueueInterceptTargets() {
    const targets = [];
    for (const node of app.graph?._nodes || []) {
        if (!isBatchLoadImagesNode(node) || !getImageListWidget(node)) continue;
        const action = getControlActionForBatchNode(node);
        if (action === "逐张执行" || action === "执行首张") {
            targets.push({ node, action });
        }
    }
    return targets;
}

function installQueueInterceptor() {
    if (app._xmtBLImagesQueueInterceptorInstalled || typeof app.queuePrompt !== "function") return;
    app._xmtBLImagesQueueInterceptorInstalled = true;
    const originalQueuePrompt = app.queuePrompt;

    app.queuePrompt = async function () {
        if (app._xmtBLImagesQueueIntercepting) {
            return await originalQueuePrompt.apply(this, arguments);
        }

        const targets = getQueueInterceptTargets();
        if (!targets.length) {
            return await originalQueuePrompt.apply(this, arguments);
        }

        app._xmtBLImagesQueueIntercepting = true;
        try {
            for (const { node, action } of targets) {
                if (action === "逐张执行") await queueAllSequential(node);
                else if (action === "执行首张") await queueFirstImage(node);
            }
        } finally {
            app._xmtBLImagesQueueIntercepting = false;
        }
    };
}

function getViewUrl(filename) { return api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=input${app.getPreviewFormatParam?.() || ""}${app.getRandParam?.() || ""}`); }

function resizeBatchLoadNode(node, grid, imageCount, { fitNode = true } = {}) {
    if (!node || !grid) return;

    const width = Math.max(Number(node.size?.[0]) || 420, 280);
    const panelWidth = Math.max(width - 32, 220);
    const contentWidth = Math.max(width - 36, PREVIEW_MIN_CELL);
    const columns = contentWidth >= 620 ? 4 : contentWidth >= 420 ? 3 : contentWidth >= 210 ? 2 : 1;
    const rows = imageCount > 0 ? Math.ceil(imageCount / columns) : 1;
    const visibleRows = Math.max(1, Math.min(rows, PREVIEW_MAX_VISIBLE_ROWS));
    const cellWidth = Math.floor((contentWidth - PREVIEW_GAP * (columns - 1)) / columns);
    const cellHeight = cellWidth + 18;
    const gridHeight = visibleRows * cellHeight + (visibleRows - 1) * PREVIEW_GAP + 12;
    const nodeHeight = 130 + gridHeight;
    const container = grid.parentElement;

    if (container) {
        container.style.width = `${panelWidth}px`;
        container.style.maxWidth = `${panelWidth}px`;
    }
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    grid.style.height = `${gridHeight}px`;
    grid.style.maxHeight = `${gridHeight}px`;
    grid.style.overflowY = rows > visibleRows ? "auto" : "hidden";
    if (fitNode && !node._batchLoadImagesApplyingLayout) {
        node._batchLoadImagesApplyingLayout = true;
        node.setSize?.([width, Math.max(300, nodeHeight)]);
        requestAnimationFrame(() => { node._batchLoadImagesApplyingLayout = false; });
    }
}

function isFilesDragEvent(e) {
    const dt = e?.dataTransfer;
    return dt && ((dt.files && dt.files.length > 0) || Array.from(dt.types || []).includes("Files"));
}

async function uploadOneImage(file) {
    const body = new FormData(); body.append("image", file, file.name); body.append("type", "input");
    const resp = await api.fetchApi("/upload/image", { method: "POST", body });
    if (!resp.ok) throw new Error(await resp.text());
    return (await resp.json())?.name;
}

// 馃殌 鏋侀€熷苟鍙戜笂浼狅紝涓嶅崱姝?UI
async function uploadFilesSequential(node, files, { replace = false } = {}, infoElement) {
    const w = getImageListWidget(node);
    if (!w) return [];

    const existing = replace ? [] : parseImageList(w.value);
    const uploaded = [];

    if (infoElement) infoElement.textContent = `正在上传 ${files.length} 张图片，请稍等...`;

    const uploadPromises = files.map(async (file) => {
        if (!file) return null;
        if (file?.type && !file.type.startsWith("image/")) return null;
        return await uploadOneImage(file);
    });

    const results = await Promise.all(uploadPromises);
    results.forEach(name => { if (name) uploaded.push(name); });

    setImageList(node, existing.concat(uploaded));
    return uploaded;
}

function openMultiSelect(node, { replace = false, infoElem = null } = {}) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async (e) => {
        try { await uploadFilesSequential(node, Array.from(e.target.files || []), { replace }, infoElem); } 
        finally { document.body.removeChild(input); }
    };
    input.click();
}

function openFolderSelect(node, { replace = false, infoElem = null } = {}) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.webkitdirectory = true;
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async (e) => {
        try {
            const allowExt = new Set([".png", ".jpg", ".jpeg", ".webp"]);
            let files = Array.from(e.target.files || []).filter(f => {
                const name = (f?.name || "").toLowerCase();
                return Array.from(allowExt).some(ext => name.endsWith(ext));
            });
            files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
            await uploadFilesSequential(node, files, { replace }, infoElem);
        } finally { document.body.removeChild(input); }
    };
    input.click();
}

function createBrowserUI(node) {
    const container = document.createElement("div");
    container.style.cssText = `width:100%;box-sizing:border-box;padding:8px;background:var(--comfy-menu-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:6px;margin:5px 0;pointer-events:auto;overflow:hidden;`;

    const btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;";
    const mkBtn = (label) => {
        const b = document.createElement("button"); b.textContent = label;
        b.style.cssText = `flex:1 1 96px;min-width:0;padding:8px;background:var(--comfy-input-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:13px;`;
        return b;
    };

    const replaceBtn = mkBtn("重新上传"); const addBtn = mkBtn("追加图片"); const folderBtn = mkBtn("上传文件夹");
    const queueBtn = mkBtn("逐张执行"); const queueOneBtn = mkBtn("执行首张"); const clearBtn = mkBtn("清空");

    btnRow.append(replaceBtn, addBtn, folderBtn, queueBtn, queueOneBtn, clearBtn);

    const info = document.createElement("div"); info.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};margin-bottom:6px;font-weight:bold;`;
    const grid = document.createElement("div"); grid.style.cssText = `display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:max-content;gap:${PREVIEW_GAP}px;height:224px;max-height:224px;overflow-y:auto;overflow-x:hidden;align-content:start;background:var(--comfy-input-bg);padding:6px;border-radius:4px;box-sizing:border-box;`;

    const updateInfo = () => { info.textContent = `已就绪：共加载 ${parseImageList(getImageListWidget(node)?.value).length} 张图片`; };

    const redraw = () => {
        const names = parseImageList(getImageListWidget(node)?.value);
        grid.innerHTML = "";
        const frag = document.createDocumentFragment();

        names.forEach((name, idx) => {
            const cell = document.createElement("div"); cell.style.cssText = "display:flex;flex-direction:column;gap:3px;min-width:0;overflow:hidden;";
            const thumb = document.createElement("div"); thumb.style.cssText = "position:relative;aspect-ratio:1;border-radius:4px;overflow:hidden;border:1px solid var(--border-color);background:#111;";
            
            const img = document.createElement("img"); 
            img.src = getViewUrl(name); 
            img.loading = "lazy"; // 鍥剧墖鎳掑姞杞?
            img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;";

            const del = document.createElement("button"); del.textContent = "×";
            del.style.cssText = "position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(255,0,0,0.75);color:#fff;border:none;border-radius:3px;cursor:pointer;";
            del.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                setImageList(node, names.slice(0, idx).concat(names.slice(idx + 1))); redraw();
            };

            const label = document.createElement("div"); label.textContent = name;
            label.style.cssText = `font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${XMT_TEXT_COLOR};opacity:0.9;`;

            thumb.append(img, del); cell.append(thumb, label); frag.appendChild(cell);
        });

        grid.appendChild(frag); updateInfo(); resizeBatchLoadNode(node, grid, names.length); app.graph.setDirtyCanvas(true);
    };

    const relayout = (options = {}) => {
        resizeBatchLoadNode(node, grid, parseImageList(getImageListWidget(node)?.value).length, options);
        app.graph.setDirtyCanvas(true);
    };

    container.addEventListener("dragover", (e) => { if (isFilesDragEvent(e)) { e.preventDefault(); e.stopPropagation(); container.style.border = `2px dashed ${XMT_TEXT_COLOR}`; } });
    container.addEventListener("dragleave", (e) => { if (isFilesDragEvent(e)) { e.preventDefault(); e.stopPropagation(); container.style.border = "1px solid var(--border-color)"; } });
    container.addEventListener("drop", async (e) => {
        if (!isFilesDragEvent(e)) return;
        e.preventDefault(); e.stopPropagation(); container.style.border = "1px solid var(--border-color)";
        await uploadFilesSequential(node, Array.from(e.dataTransfer?.files || []), { replace: false }, info);
        redraw();
    });

    replaceBtn.onclick = async () => openMultiSelect(node, { replace: true, infoElem: info });
    addBtn.onclick = async () => openMultiSelect(node, { replace: false, infoElem: info });
    folderBtn.onclick = async () => openFolderSelect(node, { replace: true, infoElem: info });
    queueBtn.onclick = async () => await queueAllSequential(node);
    queueOneBtn.onclick = async () => await queueFirstImage(node);
    clearBtn.onclick = () => { setImageList(node, []); redraw(); };

    container.append(btnRow, info, grid);
    return { container, redraw, relayout };
}

function getLinkedBatchLoadNodes(node) {
    const linked = [];
    const linkIds = node?.outputs?.[0]?.links || [];
    for (const linkId of linkIds) {
        const link = app.graph?.links?.[linkId];
        const targetNode = link ? app.graph.getNodeById(link.target_id) : null;
        if (isBatchLoadImagesNode(targetNode) && getImageListWidget(targetNode)) linked.push(targetNode);
    }
    return linked;
}

function getUsableBatchLoadNodes(node) {
    const linked = getLinkedBatchLoadNodes(node);
    if (linked.length) return linked;

    const selected = Object.values(app.canvas?.selected_nodes || {})
        .filter((n) => n !== node && isBatchLoadImagesNode(n) && getImageListWidget(n));
    if (selected.length) return selected;

    const all = (app.graph?._nodes || [])
        .filter((n) => n !== node && isBatchLoadImagesNode(n) && getImageListWidget(n));
    return all.length === 1 ? all : [];
}

function getAppendTargetNodes(node) {
    const linked = [];
    const appendOutput = node?.outputs?.find((output) => output?.name === "append") || node?.outputs?.[0];
    const linkIds = appendOutput?.links || [];
    for (const linkId of linkIds) {
        const link = app.graph?.links?.[linkId];
        const targetNode = link ? app.graph.getNodeById(link.target_id) : null;
        if (isBatchLoadImagesNode(targetNode) && getImageListWidget(targetNode)) linked.push(targetNode);
    }
    return linked;
}

function normalizeExternalUploadOutputs(node) {
    if (!node || !Array.isArray(node.outputs)) return;
    const linkedAppend = node.outputs.find((output) => output?.name === "append" && output?.links?.length);
    const appendOutput = linkedAppend || node.outputs.find((output) => output?.name === "append") || node.outputs[0];
    if (!appendOutput) {
        node.addOutput?.("append", "XMT_BLIMAGE_APPEND");
    } else {
        appendOutput.name = "append";
        appendOutput.type = "XMT_BLIMAGE_APPEND";
        node.outputs = [appendOutput];
    }
}

function appendNamesToBatchNodes(targets, names) {
    for (const target of targets) {
        const current = parseImageList(getImageListWidget(target)?.value);
        setImageList(target, current.concat(names));
        target._batchLoadImagesUI?.redraw?.();
    }
}

function appendExternalImageName(node, name) {
    if (!name) return;
    const targets = getAppendTargetNodes(node);
    if (!targets.length) return;
    appendNamesToBatchNodes(targets, [name]);
    app.graph.setDirtyCanvas(true);
}

function createExternalImageUploadUI(node) {
    const imageWidget = getExternalImageWidget(node);
    neutralizeWidget(imageWidget);

    const container = document.createElement("div");
    container.style.cssText = `width:100%;box-sizing:border-box;padding:8px;color:${XMT_TEXT_COLOR};pointer-events:auto;`;

    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "上传图片";
    uploadBtn.style.cssText = `width:100%;padding:8px;background:var(--comfy-input-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:13px;margin-bottom:8px;`;

    const drop = document.createElement("div");
    drop.style.cssText = `height:118px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--border-color);border-radius:6px;background:transparent;color:${XMT_TEXT_COLOR};font-size:13px;overflow:hidden;`;
    drop.textContent = "拖拽 / 点击上传图片";

    const preview = document.createElement("img");
    preview.style.cssText = "width:100%;height:100%;object-fit:contain;display:none;";

    const info = document.createElement("div");
    info.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};margin-top:8px;font-weight:bold;`;

    const setPreview = (name) => {
        if (!name) {
            preview.style.display = "none";
            drop.textContent = "拖拽 / 点击上传图片";
            if (!drop.contains(preview)) drop.appendChild(preview);
            return;
        }
        drop.textContent = "";
        preview.src = getViewUrl(name);
        preview.style.display = "block";
        drop.appendChild(preview);
    };

    const appendFiles = async (files) => {
        const imageFiles = Array.from(files || []).filter((file) => !file?.type || file.type.startsWith("image/"));
        if (!imageFiles.length) return;

        const targets = getAppendTargetNodes(node);
        if (!targets.length) {
            info.textContent = "请把 append 输出连接到批量图片加载节点的 append 输入";
            return;
        }

        info.textContent = `正在上传 ${imageFiles.length} 张图片，请稍等...`;
        const uploaded = [];
        for (const file of imageFiles) {
            const name = await uploadOneImage(file);
            if (name) uploaded.push(name);
        }
        if (!uploaded.length) {
            info.textContent = "没有成功上传的图片";
            return;
        }

        appendNamesToBatchNodes(targets, uploaded);
        if (imageWidget) {
            imageWidget.value = uploaded[uploaded.length - 1];
            imageWidget.callback?.(imageWidget.value);
        }
        setPreview(uploaded[uploaded.length - 1]);
        info.textContent = `已追加 ${uploaded.length} 张图片到批量加载节点`;
        app.graph.setDirtyCanvas(true);
    };

    const openUpload = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async (e) => {
            try { await appendFiles(e.target.files); }
            finally { document.body.removeChild(input); }
        };
        input.click();
    };

    uploadBtn.onclick = openUpload;
    drop.onclick = openUpload;
    drop.addEventListener("dragover", (e) => { if (isFilesDragEvent(e)) { e.preventDefault(); e.stopPropagation(); drop.style.border = `1px dashed ${XMT_TEXT_COLOR}`; } });
    drop.addEventListener("dragleave", (e) => { if (isFilesDragEvent(e)) { e.preventDefault(); e.stopPropagation(); drop.style.border = "1px dashed var(--border-color)"; } });
    drop.addEventListener("drop", async (e) => {
        if (!isFilesDragEvent(e)) return;
        e.preventDefault();
        e.stopPropagation();
        drop.style.border = "1px dashed var(--border-color)";
        await appendFiles(e.dataTransfer?.files);
    });

    container.append(uploadBtn, drop, info);
    setPreview(imageWidget?.value);
    return { container };
}

function createNodeSelectSwitchUI(node) {
    const buttonWidget = getWidgetByName(node, "button");
    neutralizeWidget(buttonWidget);

    const container = document.createElement("div");
    container.style.cssText = `box-sizing:border-box;height:${NODE_SELECT_SWITCH_WIDGET_HEIGHT}px;min-height:${NODE_SELECT_SWITCH_WIDGET_HEIGHT}px;padding:4px 0 0;margin:0;color:${XMT_TEXT_COLOR};pointer-events:auto;background:transparent;border:none;position:relative;overflow:visible;`;

    const labels = ["\u91cd\u65b0\u4e0a\u4f20", "\u8ffd\u52a0\u56fe\u7247", "\u4e0a\u4f20\u6587\u4ef6\u5939", "\u9010\u5f20\u6267\u884c", "\u6267\u884c\u9996\u5f20", "\u6e05\u7a7a"];
    const legacyLabelMap = { "\u91cd\u65b0\u9009\u62e9": "\u91cd\u65b0\u4e0a\u4f20", "\u9009\u6587\u4ef6\u5939": "\u4e0a\u4f20\u6587\u4ef6\u5939" };

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.style.cssText = `width:100%;box-sizing:border-box;margin-bottom:8px;padding:8px 28px 8px 8px;background:var(--comfy-input-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:4px;font-size:13px;text-align:left;cursor:pointer;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;

    const selectedText = document.createElement("span");
    selectedText.style.cssText = "display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    selectBtn.appendChild(selectedText);

    const arrow = document.createElement("span");
    arrow.textContent = "\u25be";
    arrow.style.cssText = "position:absolute;right:9px;top:50%;transform:translateY(-50%);pointer-events:none;";
    selectBtn.appendChild(arrow);

    const menu = document.createElement("div");
    menu.style.cssText = `display:none;position:relative;z-index:2;width:100%;margin:-4px 0 6px;background:var(--comfy-input-bg);border:1px solid var(--border-color);border-radius:4px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.25);`;

    const buttonWrap = document.createElement("div");
    buttonWrap.style.cssText = "display:flex;gap:6px;";

    const info = document.createElement("div");
    info.style.cssText = `font-size:12px;color:${XMT_TEXT_COLOR};margin-top:6px;font-weight:bold;`;

    const relayout = () => {
        const width = Math.max(180, Math.floor((Number(node?.size?.[0]) || NODE_SELECT_SWITCH_SIZE[0]) - 32));
        container.style.width = `${width}px`;
        container.style.maxWidth = `${width}px`;
    };

    const setAction = (value) => {
        const action = legacyLabelMap[value] || value || labels[0];
        const next = labels.includes(action) ? action : labels[0];
        if (buttonWidget && buttonWidget.value !== next) {
            buttonWidget.value = next;
            buttonWidget.callback?.(buttonWidget.value);
        }
        return next;
    };

    const mkBtn = (label) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = `flex:1;padding:8px;background:var(--comfy-input-bg);color:${XMT_TEXT_COLOR};border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        return b;
    };

    const runAction = async (action) => {
        info.textContent = `\u6b63\u5728\u6267\u884c\uff1a${action}`;
        const targets = getUsableBatchLoadNodes(node);
        if (!targets.length) {
            info.textContent = "\u8bf7\u8fde\u63a5\u6279\u91cf\u56fe\u7247\u52a0\u8f7d\u8282\u70b9\uff0c\u6216\u9009\u4e2d\u4e00\u4e2a\u6279\u91cf\u56fe\u7247\u52a0\u8f7d\u8282\u70b9\u540e\u518d\u70b9\u51fb";
            return;
        }

        for (const target of targets) {
            if (action === labels[0]) openMultiSelect(target, { replace: true, infoElem: info });
            else if (action === labels[1]) openMultiSelect(target, { replace: false, infoElem: info });
            else if (action === labels[2]) openFolderSelect(target, { replace: true, infoElem: info });
            else if (action === labels[3]) await queueAllSequential(target);
            else if (action === labels[4]) {
                const indexWidget = getWidgetByName(node, "index");
                if (indexWidget) { indexWidget.value = 0; indexWidget.callback?.(indexWidget.value); }
                await queueFirstImage(target);
            } else if (action === labels[5]) {
                setImageList(target, []);
                target._batchLoadImagesUI?.redraw?.();
            }
        }
        info.textContent = `\u5df2\u6267\u884c\uff1a${action}`;
    };

    const redraw = () => {
        const current = setAction(buttonWidget?.value);
        selectedText.textContent = current;
        buttonWrap.innerHTML = "";
        const btn = mkBtn(current);
        btn.addEventListener("pointerdown", (e) => e.stopPropagation());
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await runAction(setAction(buttonWidget?.value));
        });
        buttonWrap.appendChild(btn);
        info.textContent = `\u5df2\u9009\u62e9\uff1a${current}`;
        app.graph.setDirtyCanvas(true);
    };

    const closeMenu = () => {
        menu.style.display = "none";
        arrow.textContent = "\u25be";
    };

    const openMenu = () => {
        menu.style.display = "block";
        arrow.textContent = "\u25b4";
    };

    selectBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    selectBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.style.display === "block") closeMenu();
        else openMenu();
    });

    labels.forEach((label) => {
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = label;
        item.style.cssText = `display:block;width:100%;box-sizing:border-box;padding:7px 8px;background:transparent;color:${XMT_TEXT_COLOR};border:0;text-align:left;cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        item.addEventListener("pointerdown", (e) => e.stopPropagation());
        item.addEventListener("mouseenter", () => { item.style.background = "rgba(100,181,246,0.28)"; });
        item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
        item.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAction(label);
            closeMenu();
            redraw();
        });
        menu.appendChild(item);
    });

    container.append(selectBtn, menu, buttonWrap, info);
    relayout();
    return { container, redraw, relayout };
}

app.registerExtension({
    name: "ComfyUI_xmt_BLImages.Extension",
    setup() {
        installQueueInterceptor();
        setTimeout(installQueueInterceptor, 500);
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        // 馃挕 鍙岄噸鍏煎锛氬悓鏃舵帴绠℃棫鐗?ID 鍜屾柊鐗?ID锛岀‘淇濈敾甯冧笂鐨勬棫鑺傜偣涔熻兘鏄剧ず UI锛屼笉浼氬彉鎴愬師鐢熼粦妗嗭紒
        if (nodeData.name !== "ComfyUI_xmt_BLImages" && nodeData.name !== "BatchLoadImages") return;
        
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);
            applyNodeTextColor(this);
            const w = getImageListWidget(this);
            
            // 瀹夊叏闅愯韩
            neutralizeWidget(w);

            const ui = createBrowserUI(this);
            this._batchLoadImagesUI = ui;
            const domWidget = this.addDOMWidget("batch_load_images", "customwidget", ui.container);
            if (domWidget) {
                domWidget.computeSize = () => {
                    const width = Math.max(Number(this.size?.[0]) || 420, 280);
                    const names = parseImageList(getImageListWidget(this)?.value);
                    const contentWidth = Math.max(width - 36, PREVIEW_MIN_CELL);
                    const columns = contentWidth >= 620 ? 4 : contentWidth >= 420 ? 3 : contentWidth >= 210 ? 2 : 1;
                    const rows = names.length > 0 ? Math.ceil(names.length / columns) : 1;
                    const visibleRows = Math.max(1, Math.min(rows, PREVIEW_MAX_VISIBLE_ROWS));
                    const cellWidth = Math.floor((contentWidth - PREVIEW_GAP * (columns - 1)) / columns);
                    const cellHeight = cellWidth + 18;
                    const gridHeight = visibleRows * cellHeight + (visibleRows - 1) * PREVIEW_GAP + 12;
                    return [Math.max(width - 32, 220), Math.max(170, 92 + gridHeight)];
                };
            }
            this.setSize([420, 320]);
            const origOnResize = this.onResize;
            this.onResize = function () {
                const result = origOnResize?.apply(this, arguments);
                if (!this._batchLoadImagesApplyingLayout) {
                    cancelAnimationFrame(this._batchLoadImagesResizeRAF);
                    this._batchLoadImagesResizeRAF = requestAnimationFrame(() => {
                        this._batchLoadImagesUI?.relayout?.({ fitNode: false });
                    });
                    clearTimeout(this._batchLoadImagesResizeTimer);
                    this._batchLoadImagesResizeTimer = setTimeout(() => {
                        this._batchLoadImagesUI?.relayout?.({ fitNode: false });
                    }, 180);
                }
                return result;
            };
            
            if (w) { const orig = w.callback; w.callback = function (v) { orig?.call(this, v); ui.redraw(); }; }
            ui.redraw(); return r;
        };
        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (output) { origOnExecuted?.apply(this, arguments); this._batchLoadImagesUI?.redraw?.(); };
    },
});

app.registerExtension({
    name: "VNCCS.VisualPositionControl.Extension",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "VNCCS_VisualPositionControl") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);
            applyNodeTextColor(this);

            const ui = createVNCCSVisualUI(this);
            if (ui) {
                this.addDOMWidget("vnccs_visual", "customwidget", ui.container);
                this.setSize([420, 220]);
                ui.read();
            }

            return r;
        };
    },
});

app.registerExtension({
    name: "ComfyUI_xmt_BLImages.NodeSelectSwitch",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ComfyUI_xmt_NodeSelectSwitch" && nodeData.name !== "NodeSelectSwitch") return;
        nodeData.display_name = "\u718a\u732b\u5934\u5c01\u88c5\u8282\u70b9\u5207\u6362";
        nodeType.title = "\u718a\u732b\u5934\u5c01\u88c5\u8282\u70b9\u5207\u6362";

        const forceSwitchTitle = (node) => {
            node.title = "\u718a\u732b\u5934\u5c01\u88c5\u8282\u70b9\u5207\u6362";
        };

        const scheduleSwitchLayout = (node) => {
            requestAnimationFrame(() => {
                forceSwitchTitle(node);
                node._nodeSelectSwitchUI?.relayout?.();
                node._nodeSelectSwitchUI?.redraw?.();
                app.graph?.setDirtyCanvas?.(true, true);
            });
        };

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);
            applyNodeTextColor(this);
            forceSwitchTitle(this);
            const ui = createNodeSelectSwitchUI(this);
            this._nodeSelectSwitchUI = ui;
            const domWidget = this.addDOMWidget("node_select_switch", "customwidget", ui.container);
            if (domWidget) {
                domWidget.computeSize = () => [
                    Math.max(180, Math.floor((Number(this.size?.[0]) || NODE_SELECT_SWITCH_SIZE[0]) - 32)),
                    NODE_SELECT_SWITCH_WIDGET_HEIGHT,
                ];
            }
            this.setSize(NODE_SELECT_SWITCH_SIZE);
            ui.redraw();
            scheduleSwitchLayout(this);
            const origOnResize = this.onResize;
            this.onResize = function () {
                const result = origOnResize?.apply(this, arguments);
                if (!this._nodeSelectSwitchResizeRAF) {
                    this._nodeSelectSwitchResizeRAF = requestAnimationFrame(() => {
                        this._nodeSelectSwitchResizeRAF = null;
                        forceSwitchTitle(this);
                        this._nodeSelectSwitchUI?.relayout?.();
                    });
                }
                return result;
            };
            return r;
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = origOnConfigure?.apply(this, arguments);
            forceSwitchTitle(this);
            scheduleSwitchLayout(this);
            return r;
        };
    },
});

app.registerExtension({
    name: "ComfyUI_xmt_BLImages.ExternalImageUpload",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ComfyUI_xmt_ExternalImageUpload") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);
            applyNodeTextColor(this);
            this.title = "熊猫头外置图片加载";
            normalizeExternalUploadOutputs(this);
            const uploadNode = this;
            const imageWidget = getExternalImageWidget(this);
            if (imageWidget) {
                let lastValue = imageWidget.value;
                const orig = imageWidget.callback;
                imageWidget.callback = function (value) {
                    orig?.call(this, value);
                    const nextValue = value || this.value;
                    if (nextValue && nextValue !== lastValue) {
                        lastValue = nextValue;
                        appendExternalImageName(uploadNode, nextValue);
                    }
                };
            }
            this.setSize(EXTERNAL_UPLOAD_SIZE);
            return r;
        };
    },
});





