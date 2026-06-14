import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function getWidgetByName(node, name) { 
    return node?.widgets?.find((w) => w.name === name); 
}

function getImageListWidget(node) {
    return getWidgetByName(node, "image_list");
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

// 💡 终极修复：去掉了闯祸的 splice 排序逻辑，只做安全的尺寸抵消和物理隐身
function neutralizeWidget(w) {
    if (!w) return;
    w.type = "hidden";
    w.hidden = true;
    w.computeSize = () => [0, -4]; // 完美抵消 LiteGraph 强制加上的 4px 间距缝隙
    w.draw = () => {}; // 阻止画布引擎画出白点
    
    const killDOM = () => {
        if (w.element) {
            w.element.style.setProperty('display', 'none', 'important');
            w.element.style.setProperty('pointer-events', 'none', 'important');
            w.element.style.setProperty('position', 'absolute', 'important');
            w.element.style.setProperty('width', '0px', 'important');
            w.element.style.setProperty('height', '0px', 'important');
        }
        if (w.inputEl) {
            w.inputEl.disabled = true; // 彻底剥夺可点击属性，杜绝出现白框光环
            w.inputEl.style.setProperty('display', 'none', 'important');
        }
    };
    
    killDOM();
    setTimeout(killDOM, 50);
    setTimeout(killDOM, 200);
}

function createVNCCSVisualUI(node) {
    const w = getWidgetByName(node, "camera_data");
    neutralizeWidget(w);

    const container = document.createElement("div");
    container.style.cssText = "width:100%;padding:8px;background:var(--comfy-menu-bg);border:1px solid var(--border-color);border-radius:6px;margin:5px 0;pointer-events:auto;";

    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;";

    const mkField = (labelText) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";
        const label = document.createElement("div");
        label.textContent = labelText;
        label.style.cssText = "font-size:12px;opacity:0.9;";
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

    const azVal = document.createElement("div"); azVal.style.cssText = "font-size:12px;opacity:0.8;";
    const elVal = document.createElement("div"); elVal.style.cssText = "font-size:12px;opacity:0.8;";

    const promptOut = document.createElement("input"); promptOut.type = "text"; promptOut.readOnly = true;
    promptOut.style.cssText = "width:100%;padding:8px;background:var(--comfy-input-bg);color:var(--input-text);border:1px solid var(--border-color);border-radius:4px;";

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

async function queueAllSequential(node) {
    const names0 = parseImageList(getImageListWidget(node)?.value);
    if (!names0?.length) return;

    const maxImages = getMaxImagesValue(node);
    const names = maxImages > 0 ? names0.slice(0, maxImages) : names0;
    if (!names.length) return;

    const wMode = getWidgetByName(node, "mode");
    const wIndex = getWidgetByName(node, "index");
    if (!wMode || !wIndex) {
        const basePrompt = await app.graphToPrompt();
        const nodeId = String(node.id);
        for (let i = 0; i < names.length; i++) {
            const prompt = deepClone(basePrompt);
            const apiNode = prompt.output?.[nodeId];
            if (!apiNode) continue;
            apiNode.inputs = apiNode.inputs || {}; apiNode.inputs.mode = "single"; apiNode.inputs.index = i;
            await api.queuePrompt(-1, prompt);
        }
        return;
    }

    const prevMode = wMode.value, prevIndex = wIndex.value;
    try {
        wMode.value = "single"; wMode.callback?.(wMode.value);
        for (let i = 0; i < names.length; i++) {
            wIndex.value = i; wIndex.callback?.(wIndex.value);
            await queueCurrent(node);
        }
    } finally {
        wMode.value = prevMode; wMode.callback?.(wMode.value);
        wIndex.value = prevIndex; wIndex.callback?.(wIndex.value);
    }
}

function getViewUrl(filename) { return api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=input${app.getPreviewFormatParam?.() || ""}${app.getRandParam?.() || ""}`); }

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

// 🚀 极速并发上传，不卡死 UI
async function uploadFilesSequential(node, files, { replace = false } = {}, infoElement) {
    const w = getImageListWidget(node);
    if (!w) return [];

    const existing = replace ? [] : parseImageList(w.value);
    const uploaded = [];

    if (infoElement) infoElement.textContent = `⏳ 正在高速并行上传 ${files.length} 张图片，请稍等...`;

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
    container.style.cssText = "width:100%;box-sizing:border-box;padding:8px;background:var(--comfy-menu-bg);border:1px solid var(--border-color);border-radius:6px;margin:5px 0;pointer-events:auto;";

    const btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;gap:6px;margin-bottom:8px;";
    const mkBtn = (label) => {
        const b = document.createElement("button"); b.textContent = label;
        b.style.cssText = "flex:1;padding:8px;background:var(--comfy-input-bg);color:var(--input-text);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:13px;";
        return b;
    };

    const replaceBtn = mkBtn("重新选择"); const addBtn = mkBtn("追加图片"); const folderBtn = mkBtn("选文件夹");
    const queueBtn = mkBtn("逐张入队"); const queueOneBtn = mkBtn("入队当前"); const clearBtn = mkBtn("清空");

    btnRow.append(replaceBtn, addBtn, folderBtn, queueBtn, queueOneBtn, clearBtn);

    const info = document.createElement("div"); info.style.cssText = "font-size:12px;color:#4a6;margin-bottom:6px;font-weight:bold;";
    const grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;max-height:260px;overflow-y:auto;background:var(--comfy-input-bg);padding:6px;border-radius:4px;";

    const updateInfo = () => { info.textContent = `已就绪：共加载 ${parseImageList(getImageListWidget(node)?.value).length} 张图片`; };

    const redraw = () => {
        const names = parseImageList(getImageListWidget(node)?.value);
        grid.innerHTML = "";
        const frag = document.createDocumentFragment();

        names.forEach((name, idx) => {
            const cell = document.createElement("div"); cell.style.cssText = "display:flex;flex-direction:column;gap:3px;";
            const thumb = document.createElement("div"); thumb.style.cssText = "position:relative;aspect-ratio:1;border-radius:4px;overflow:hidden;border:1px solid var(--border-color);background:#000;";
            
            const img = document.createElement("img"); 
            img.src = getViewUrl(name); 
            img.loading = "lazy"; // 图片懒加载
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";

            const del = document.createElement("button"); del.textContent = "×";
            del.style.cssText = "position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(255,0,0,0.75);color:#fff;border:none;border-radius:3px;cursor:pointer;";
            del.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                setImageList(node, names.slice(0, idx).concat(names.slice(idx + 1))); redraw();
            };

            const label = document.createElement("div"); label.textContent = name;
            label.style.cssText = "font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.9;";

            thumb.append(img, del); cell.append(thumb, label); frag.appendChild(cell);
        });

        grid.appendChild(frag); updateInfo(); app.graph.setDirtyCanvas(true);
    };

    container.addEventListener("dragover", (e) => { if (isFilesDragEvent(e)) { e.preventDefault(); e.stopPropagation(); container.style.border = "2px dashed #4a6"; } });
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
    queueOneBtn.onclick = async () => { const w = getWidgetByName(node, "mode"); if (w) { w.value = "single"; w.callback?.(w.value); } await queueCurrent(node); };
    clearBtn.onclick = () => { setImageList(node, []); redraw(); };

    container.append(btnRow, info, grid);
    return { container, redraw };
}

app.registerExtension({
    name: "ComfyUI_xmt_BLImages.Extension",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        // 💡 双重兼容：同时接管旧版 ID 和新版 ID，确保画布上的旧节点也能显示 UI，不会变成原生黑框！
        if (nodeData.name !== "ComfyUI_xmt_BLImages" && nodeData.name !== "BatchLoadImages") return;
        
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);
            const w = getImageListWidget(this);
            
            // 安全隐身
            neutralizeWidget(w);

            const ui = createBrowserUI(this);
            this._batchLoadImagesUI = ui;
            this.addDOMWidget("batch_load_images", "customwidget", ui.container);
            this.setSize([420, 320]);
            
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