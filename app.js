const get = id => document.getElementById(id);
const plane = get("plane");
const hexInput = get("hex");
const clamp = value => Math.min(1, Math.max(0, value));
const wrapHue = hue => (hue % 360 + 360) % 360;
let color;
let currentHex;
let toastTimer;
const storageKey = "sac-do-saved";

function normalizeHex(raw) {
  const value = raw.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return null;
  return "#" + (value.length === 3 ? [...value].map(char => char.repeat(2)).join("") : value).toUpperCase();
}

function fromHex(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255);
  const v = Math.max(r, g, b);
  const delta = v - Math.min(r, g, b);
  let h = color?.h ?? 0;
  if (delta) {
    if (v === r) h = 60 * (g - b) / delta;
    else if (v === g) h = 60 * (2 + (b - r) / delta);
    else h = 60 * (4 + (r - g) / delta);
  }
  return { h: wrapHue(h), s: v ? delta / v : 0, v };
}

function toRgb({ h, s, v }) {
  const channel = offset => {
    const k = (offset + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

function toHex(value) {
  return "#" + toRgb(value).map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function toHsl({ h, s, v }) {
  const light = v * (1 - s / 2);
  const saturation = light === 0 || light === 1 ? 0 : (v - light) / Math.min(light, 1 - light);
  const round = value => Math.round(value * 10) / 10;
  return "hsl(" + wrapHue(round(h)) + ", " + round(saturation * 100) + "%, " + round(light * 100) + "%)";
}

function ink(hex) {
  const channels = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255);
  const [r, g, b] = channels.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b > .179 ? "#000" : "#fff";
}

function loadSaved() {
  try {
    const values = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(values) ? values.filter(value => typeof value === "string" && normalizeHex(value) === value).slice(0, 20) : [];
  } catch {
    return [];
  }
}

let saved = loadSaved();

function message(text) {
  get("toast").textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { get("toast").textContent = ""; }, 2400);
}

function updateSavedButton() {
  const exists = saved.includes(currentHex);
  get("save").setAttribute("aria-pressed", String(exists));
  get("save").textContent = exists ? "♥ Đã lưu" : "♡ Lưu màu";
}

function swatches(container, values) {
  container.replaceChildren(...values.map(hex => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.style.backgroundColor = hex;
    button.style.color = ink(hex);
    button.textContent = hex;
    button.setAttribute("aria-label", "Chọn màu " + hex);
    button.addEventListener("click", () => {
      render(fromHex(hex));
      message("Đã chọn " + hex);
    });
    return button;
  }));
}

function renderPalette() {
  const { h, s, v } = color;
  const configs = {
    mono: [[0, -.45, .38], [0, -.22, .18], [0, 0, 0], [0, .1, -.20], [0, .16, -.40]],
    analog: [[-48, .12, -.1], [-24, -.05, .06], [0, 0, 0], [24, -.05, .06], [48, .12, -.1]],
    comp: [[0, .13, -.27], [0, -.27, .22], [0, 0, 0], [180, -.06, .08], [180, .12, -.18]],
    triad: [[-120, .06, -.18], [-120, -.19, .15], [0, 0, 0], [120, -.19, .15], [120, .06, -.18]]
  };
  let values = configs[get("scheme").value].map(([dh, ds, dv], index) => {
    if (index === 2) return currentHex;
    return toHex({ h: wrapHue(h + dh), s: clamp(s + ds), v: clamp(v + dv) });
  });
  if (get("scheme").value === "mono") {
    const step = .16;
    const left = v > .5 ? Math.min(step, (1 - v) / 2) : step;
    const right = v <= .5 ? Math.min(step, v / 2) : step;
    if (v === 1 || v === 0) {
      const direction = v === 1 ? -1 : 1;
      values = values.map((_, index) => toHex({ h, s, v: v + direction * index * step }));
      if (v === 0) values.reverse();
    } else {
      values = [v + 2 * left, v + left, v, v - right, v - 2 * right].map(value => toHex({ h, s, v: clamp(value) }));
    }
  }
  swatches(get("palette"), values);
}

function render(next) {
  color = next;
  currentHex = toHex(color);
  hexInput.value = currentHex;
  hexInput.removeAttribute("aria-invalid");
  get("hex-error").hidden = true;
  get("rgb").textContent = "rgb(" + toRgb(color).join(", ") + ")";
  get("hsl").textContent = toHsl(color);
  get("preview").style.backgroundColor = currentHex;
  get("preview").style.color = ink(currentHex);
  get("preview-code").textContent = currentHex;
  get("native").value = currentHex;
  get("hue").value = Math.min(359, Math.round(color.h));
  get("sat").value = color.s * 100;
  get("val").value = color.v * 100;
  plane.style.backgroundColor = "hsl(" + color.h + " 100% 50%)";
  get("cursor").style.left = color.s * 100 + "%";
  get("cursor").style.top = (1 - color.v) * 100 + "%";
  updateSavedButton();
  renderPalette();
}

function applyHex() {
  const hex = normalizeHex(hexInput.value);
  if (hex) {
    render(fromHex(hex));
    return true;
  }
  hexInput.setAttribute("aria-invalid", "true");
  get("hex-error").hidden = false;
  return false;
}

get("hex-form").addEventListener("submit", event => {
  event.preventDefault();
  applyHex();
});
hexInput.addEventListener("blur", () => {
  if (hexInput.value !== currentHex) applyHex();
});
hexInput.addEventListener("input", () => {
  if (/^#?[a-f0-9]{6}$/i.test(hexInput.value)) applyHex();
});
hexInput.addEventListener("keydown", event => {
  if (event.key === "Escape") render(color);
});

function movePicker(event) {
  const bounds = plane.getBoundingClientRect();
  render({ ...color, s: clamp((event.clientX - bounds.left) / bounds.width), v: 1 - clamp((event.clientY - bounds.top) / bounds.height) });
}
plane.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  plane.setPointerCapture(event.pointerId);
  movePicker(event);
});
plane.addEventListener("pointermove", event => {
  if (plane.hasPointerCapture(event.pointerId)) movePicker(event);
});

for (const [id, key, scale] of [["hue", "h", 1], ["sat", "s", 100], ["val", "v", 100]]) {
  get(id).addEventListener("input", event => render({ ...color, [key]: event.target.valueAsNumber / scale }));
}
get("native").addEventListener("input", event => render(fromHex(event.target.value)));
get("random").addEventListener("click", () => render({ h: Math.floor(Math.random() * 360), s: .25 + Math.random() * .7, v: .42 + Math.random() * .58 }));
get("scheme").addEventListener("change", renderPalette);
get("save").addEventListener("click", () => {
  const exists = saved.includes(currentHex);
  saved = exists ? saved.filter(hex => hex !== currentHex) : [currentHex, ...saved].slice(0, 20);
  let notice = exists ? "Đã bỏ lưu " : "Đã lưu ";
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    if (!exists) notice = "Đã lưu trong phiên này ";
  }
  updateSavedButton();
  renderSaved();
  message(notice + currentHex);
});

function renderSaved() {
  get("saved-section").hidden = !saved.length;
  swatches(get("saved"), saved);
}

document.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", async () => {
  const format = button.dataset.copy;
  if (format === "hex" && !applyHex()) {
    hexInput.focus();
    return;
  }
  const value = format === "hex" ? currentHex : get(format).textContent;
  try {
    await navigator.clipboard.writeText(value);
    message("Đã sao chép " + value);
  } catch {
    message("Không thể truy cập bộ nhớ tạm.");
  }
}));

render(fromHex("#B7F36A"));
renderSaved();
