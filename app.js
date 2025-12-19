const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const toast = document.getElementById("toast");
const splash = document.getElementById("splash");
const resetBtn = document.getElementById("reset-btn");
const statHarvested = document.getElementById("stat-harvested");
const statCombo = document.getElementById("stat-combo");
const soundToggle = document.getElementById("sound-toggle");
const musicToggle = document.getElementById("music-toggle");

const urlParams = new URLSearchParams(window.location.search);
const isPlayable = urlParams.has("playable");
if (isPlayable) {
  document.body.classList.add("playable");
}

const state = {
  crops: [],
  particles: [],
  reveals: [],
  harvested: 0,
  combo: 0,
  showSplash: true,
  tutorialMode: false,
  lastHarvestTime: 0,
  hoveredCrop: null,
  soundEnabled: true,
  musicEnabled: true,
  platformAudioEnabled: true,
  audioReady: false,
};

// Replace the file paths below with your real art.
// Logo: assets/branding/logo.png
// Field background: assets/field/field.png
// Crop items: assets/items/*.png
// SFX + music live in assets/sfx and assets/music.
const assets = {
  music: {
    background: "assets/music/relaxing-loop.mp3",
  },
  sfx: {
    harvest: "assets/sfx/harvest-pop.mp3",
    reveal: "assets/sfx/reveal-poof.mp3",
  },
  images: {
    Carrot: "assets/items/carrot.png",
    Tomato: "assets/items/tomato.png",
    Lettuce: "assets/items/lettuce.png",
    "Golden Beet": "assets/items/golden-beet.png",
    field: "assets/field/field.png",
  },
};

const audio = {
  music: null,
  sfx: {},
};

const playablesSdk = window.playables || null;

const imageCache = {};

const cropTypes = [
  {
    name: "Carrot",
    color: "#f9a65a",
    stem: "#6fbf73",
    value: 1,
    weight: 4,
  },
  {
    name: "Tomato",
    color: "#f26d6d",
    stem: "#6fbf73",
    value: 2,
    weight: 3,
  },
  {
    name: "Lettuce",
    color: "#7cc576",
    stem: "#4a9c5d",
    value: 1,
    weight: 3,
  },
  {
    name: "Golden Beet",
    color: "#ffd166",
    stem: "#9c7b29",
    value: 3,
    weight: 1,
    golden: true,
  },
];

const field = {
  width: canvas.width,
  height: canvas.height,
  center: { x: canvas.width / 2, y: canvas.height / 2 },
};

const ensureAudioReady = () => {
  if (state.audioReady) {
    return;
  }
  state.audioReady = true;
  audio.music = new Audio(assets.music.background);
  audio.music.loop = true;
  audio.music.volume = 0.35;
  audio.sfx.harvest = new Audio(assets.sfx.harvest);
  audio.sfx.harvest.volume = 0.6;
  audio.sfx.reveal = new Audio(assets.sfx.reveal);
  audio.sfx.reveal.volume = 0.7;
  if (state.musicEnabled && state.platformAudioEnabled) {
    audio.music.play().catch(() => {});
  }
};

const playSfx = (soundKey) => {
  if (!state.audioReady || !state.soundEnabled || !state.platformAudioEnabled) {
    return;
  }
  const source = audio.sfx[soundKey];
  if (!source) {
    return;
  }
  const clone = source.cloneNode();
  clone.volume = source.volume;
  clone.play().catch(() => {});
};

const toggleSound = () => {
  state.soundEnabled = !state.soundEnabled;
  updateAudioUi();
};

const toggleMusic = () => {
  state.musicEnabled = !state.musicEnabled;
  updateAudioUi();
  if (!state.audioReady) {
    return;
  }
  if (state.musicEnabled && state.platformAudioEnabled) {
    audio.music.play().catch(() => {});
  } else {
    audio.music.pause();
  }
};

const updateAudioUi = () => {
  if (state.platformAudioEnabled) {
    soundToggle.textContent = state.soundEnabled ? "🔊 Sound: On" : "🔈 Sound: Off";
    musicToggle.textContent = state.musicEnabled ? "🎵 Music: On" : "🎵 Music: Off";
    return;
  }
  soundToggle.textContent = "🔇 Sound: YouTube Muted";
  musicToggle.textContent = "🔇 Music: YouTube Muted";
};

const applyPlatformAudioState = (enabled) => {
  state.platformAudioEnabled = Boolean(enabled);
  updateAudioUi();
  if (!state.audioReady) {
    return;
  }
  if (state.platformAudioEnabled && state.musicEnabled) {
    audio.music.play().catch(() => {});
  } else {
    audio.music.pause();
  }
};

const initPlayablesSdk = () => {
  if (!playablesSdk) {
    updateAudioUi();
    return;
  }

  const initialAudio = playablesSdk.isAudioEnabled?.();
  if (typeof initialAudio?.then === "function") {
    initialAudio.then(applyPlatformAudioState).catch(() => {});
  } else if (typeof initialAudio === "boolean") {
    applyPlatformAudioState(initialAudio);
  }

  playablesSdk.onAudioEnabledChange?.((enabled) => {
    applyPlatformAudioState(enabled);
  });
};

const rngPick = (list) => {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  return list.find((item) => {
    roll -= item.weight;
    return roll <= 0;
  });
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1100);
};

const spawnCrop = () => {
  const type = rngPick(cropTypes);
  const margin = 80;
  const crop = {
    id: Math.random().toString(36).slice(2),
    type,
    x: margin + Math.random() * (field.width - margin * 2),
    y: margin + Math.random() * (field.height - margin * 2),
    size: 26 + Math.random() * 6,
    bobOffset: Math.random() * Math.PI * 2,
  };
  state.crops.push(crop);
};

const resetField = () => {
  state.crops = [];
  state.particles = [];
  state.reveals = [];
  for (let i = 0; i < 18; i += 1) {
    spawnCrop();
  }
  state.harvested = 0;
  state.combo = 0;
  updateStats();
};

const updateStats = () => {
  statHarvested.textContent = state.harvested;
  statCombo.textContent = state.combo;
};

const createParticles = (x, y, color) => {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.8) * 4,
      life: 40 + Math.random() * 20,
      color,
    });
  }
};

const createDirtPoof = (x, y) => {
  for (let i = 0; i < 16; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.8) * 5,
      life: 45 + Math.random() * 20,
      color: "rgba(141, 86, 55, 0.9)",
    });
  }
};

const getImage = (key) => {
  if (imageCache[key]) {
    return imageCache[key];
  }
  const image = new Image();
  image.src = assets.images[key];
  imageCache[key] = image;
  return image;
};

const getCropImage = (type) => getImage(type.name);

const drawBackground = () => {
  const fieldImage = assets.images.field ? getImage("field") : null;
  if (fieldImage && fieldImage.complete && fieldImage.naturalWidth) {
    ctx.drawImage(fieldImage, 0, 0, field.width, field.height);
    return;
  }

  const skyHeight = field.height * 0.32;
  const rowHeight = 46;

  ctx.fillStyle = "#bfe9ff";
  ctx.fillRect(0, 0, field.width, field.height);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, skyHeight);
  skyGradient.addColorStop(0, "#bfe9ff");
  skyGradient.addColorStop(1, "#eaf8ff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, field.width, skyHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.ellipse(160, 80, 90, 34, 0, 0, Math.PI * 2);
  ctx.ellipse(250, 85, 70, 30, 0, 0, Math.PI * 2);
  ctx.ellipse(360, 78, 80, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.ellipse(620, 70, 95, 36, 0, 0, Math.PI * 2);
  ctx.ellipse(720, 90, 70, 28, 0, 0, Math.PI * 2);
  ctx.ellipse(810, 72, 80, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  const fieldGradient = ctx.createLinearGradient(0, skyHeight, 0, field.height);
  fieldGradient.addColorStop(0, "#9fe28f");
  fieldGradient.addColorStop(1, "#7cc576");
  ctx.fillStyle = fieldGradient;
  ctx.fillRect(0, skyHeight, field.width, field.height - skyHeight);

  for (let i = 0; i < 12; i += 1) {
    const y = skyHeight + i * rowHeight;
    ctx.fillStyle = i % 2 === 0 ? "#7bbd69" : "#8acf74";
    ctx.fillRect(0, y, field.width, rowHeight);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, y + rowHeight * 0.1, field.width, rowHeight * 0.18);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.ellipse(220, 210, 110, 42, 0, 0, Math.PI * 2);
  ctx.ellipse(700, 240, 130, 50, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawCrop = (crop, time) => {
  const bob = Math.sin(time / 500 + crop.bobOffset) * 2;
  const highlight = state.hoveredCrop && state.hoveredCrop.id === crop.id;
  const soilY = crop.y + crop.size + 14;

  ctx.fillStyle = "#9b5d3b";
  ctx.beginPath();
  ctx.ellipse(crop.x, soilY, crop.size * 1.2, crop.size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const image = getCropImage(crop.type);
  const drawSize = crop.size * 2.4;

  if (image.complete && image.naturalWidth) {
    ctx.drawImage(image, crop.x - drawSize / 2, crop.y - drawSize / 2 + bob, drawSize, drawSize);
  } else {
    ctx.strokeStyle = crop.type.stem;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(crop.x, crop.y - crop.size * 0.4 + bob);
    ctx.lineTo(crop.x, crop.y - crop.size * 1.2 + bob);
    ctx.stroke();

    ctx.fillStyle = crop.type.stem;
    ctx.beginPath();
    ctx.ellipse(crop.x - 6, crop.y - crop.size * 1.35 + bob, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(crop.x + 6, crop.y - crop.size * 1.35 + bob, 10, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (highlight) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(crop.x, crop.y + bob, crop.size * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const drawParticles = () => {
  state.particles.forEach((particle) => {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 60);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
};

const drawReveal = (reveal, time) => {
  const progress = Math.min((time - reveal.start) / reveal.duration, 1);
  const easeOut = 1 - Math.pow(1 - progress, 3);
  const scale = 0.6 + easeOut * 0.8;
  const glow = Math.sin(progress * Math.PI);
  const image = reveal.image;
  const size = reveal.size * scale;

  ctx.save();
  ctx.globalAlpha = 1 - progress * 0.2;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * glow})`;
  ctx.beginPath();
  ctx.arc(reveal.x, reveal.y, reveal.size * (1.2 + glow * 0.6), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 204, 92, ${0.8 * (1 - progress)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(reveal.x, reveal.y, reveal.size * (1 + progress * 1.2), 0, Math.PI * 2);
  ctx.stroke();

  if (image && image.complete && image.naturalWidth) {
    ctx.drawImage(image, reveal.x - size / 2, reveal.y - size / 2, size, size);
  } else {
    ctx.fillStyle = reveal.type.color;
    ctx.beginPath();
    ctx.ellipse(reveal.x, reveal.y, size * 0.55, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = `${Math.max(14, size * 0.5)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", reveal.x, reveal.y);
  }

  ctx.restore();
};

const updateParticles = () => {
  state.particles = state.particles.filter((particle) => particle.life > 0);
  state.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.08;
    particle.life -= 1;
  });
};

const render = (time) => {
  drawBackground();
  state.crops.forEach((crop) => drawCrop(crop, time));
  state.reveals.forEach((reveal) => drawReveal(reveal, time));
  drawParticles();
  updateParticles();
  state.reveals = state.reveals.filter((reveal) => time - reveal.start < reveal.duration);
  requestAnimationFrame(render);
};

const harvestCrop = (crop) => {
  const now = Date.now();
  const timeSince = now - state.lastHarvestTime;
  state.lastHarvestTime = now;
  state.combo = timeSince < 1500 ? Math.min(state.combo + 1, 9) : 0;
  const comboBonus = crop.type.golden ? 2 : 0;
  const points = crop.type.value + comboBonus;
  state.harvested += points;
  updateStats();
  createDirtPoof(crop.x, crop.y + crop.size * 0.8);
  createParticles(crop.x, crop.y - crop.size * 0.2, crop.type.color);
  state.reveals.push({
    x: crop.x,
    y: crop.y - crop.size * 0.2,
    type: crop.type,
    start: performance.now(),
    duration: 650,
    size: 72,
    image: getCropImage(crop.type),
  });
  showToast(`${crop.type.name} +${points}`);
  playSfx("harvest");
  setTimeout(() => {
    playSfx("reveal");
  }, 120);
  state.crops = state.crops.filter((item) => item.id !== crop.id);
  setTimeout(() => {
    spawnCrop();
  }, 500);
};

const getCropAt = (x, y) => {
  return state.crops.find((crop) => {
    const dx = x - crop.x;
    const dy = y - crop.y;
    return Math.sqrt(dx * dx + dy * dy) < crop.size * 1.6;
  });
};

const scalePoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

canvas.addEventListener("pointermove", (event) => {
  const point = scalePoint(event);
  state.hoveredCrop = getCropAt(point.x, point.y);
});

canvas.addEventListener("pointerleave", () => {
  state.hoveredCrop = null;
});

canvas.addEventListener("pointerdown", (event) => {
  if (state.showSplash) {
    return;
  }
  ensureAudioReady();
  const point = scalePoint(event);
  const crop = getCropAt(point.x, point.y);
  if (crop) {
    harvestCrop(crop);
  }
});

splash.addEventListener("pointerdown", () => {
  if (!state.showSplash) {
    return;
  }
  state.showSplash = false;
  splash.style.display = "none";
  ensureAudioReady();
  showToast("Click crops to pull them up!");
  playablesSdk?.gameReady?.();
});

resetBtn.addEventListener("click", () => {
  resetField();
  showToast("Fresh soil, fresh crops!");
});

soundToggle.addEventListener("click", () => {
  toggleSound();
  ensureAudioReady();
});

musicToggle.addEventListener("click", () => {
  toggleMusic();
  ensureAudioReady();
});

document.querySelectorAll("img[data-fallback]").forEach((image) => {
  const fallbackTarget = image.dataset.fallback;
  const fallbackNode = fallbackTarget ? document.querySelector(`.${fallbackTarget}`) : null;
  image.addEventListener("error", () => {
    image.style.display = "none";
    if (fallbackNode) {
      fallbackNode.style.display = "block";
    }
  });
});

resetField();
initPlayablesSdk();
requestAnimationFrame((time) => {
  playablesSdk?.firstFrameReady?.();
  render(time);
});

// Spice ideas (not shown in UI):
// - PIXI.js for layered sprite rendering + particle systems.
// - GSAP for juicy button/splash animations.
// - Howler.js for richer audio mixing and mute toggles.
// - Lottie for looping UI flourishes.
