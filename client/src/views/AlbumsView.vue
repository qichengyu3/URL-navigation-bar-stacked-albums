<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()

const albums = ref([])
const loading = ref(true)

/* ---- 确定性伪随机：同一张卡片每次渲染位置/角度/大小不变 ---- */
function rnd(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x) // 0..1
}

/* ---- 散落布局：一屏固定，禁止滚动 ----
   蓝噪声式「最佳候选采样」：每张卡随机出多个候选点，选离已放卡片最远的那个，
   覆盖均匀（无大片空白）又完全随机（无行列感）；视口变化时重算。
   每张卡片以「页面中心」为原点记录落位偏移 (ox, oy)，供入场发散定位使用 */
const cols = ref(5)
const vw = ref(1440)
const vh = ref(900)
const isMobile = ref(false)
// 手机端不用「散落一屏」那套（小屏堆叠会互相遮挡），改成正常上下排列的卡片列表。
// 用 matchMedia 判断，和 CSS 的 639px 断点完全同源（window.innerWidth 在部分
// 移动端/缩放场景下会给出偏大的值，不可靠）
function syncLayout() {
  const w = document.documentElement.clientWidth || window.innerWidth
  vw.value = w
  vh.value = window.innerHeight
  cols.value = w < 768 ? 3 : w < 1100 ? 4 : 5
  isMobile.value = window.matchMedia('(max-width: 639px)').matches
}

/* 尺寸档位：30% 大 / 45% 中 / 25% 小 */
function sizeIdx(i) {
  const r = rnd(i, 5)
  return r < 0.3 ? 0 : r < 0.75 ? 1 : 2
}

/* 力导向去遮挡：保证每张卡片至少露出约 1/3（严重遮挡时尽量拉开）。
   以轴对齐包围盒近似（散落角度仅 ±6°，误差可忽略），对每对重叠卡片施加
   正比于重叠比例的斥力 + 边界弹簧，迭代推开直到最严重重叠降到 2/3 以下或达上限。
   全程确定性（无真随机），每次渲染结果一致。 */
function forceSeparate(boxes, vw, vh) {
  const RATIO = 2 / 3
  const n = boxes.length
  for (let iter = 0; iter < 250; iter++) {
    const fx = new Array(n).fill(0)
    const fy = new Array(n).fill(0)
    let maxOv = 0
    for (let i = 0; i < n; i++) {
      const a = boxes[i]
      for (let j = i + 1; j < n; j++) {
        const b = boxes[j]
        const ovW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const ovH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ovW <= 0 || ovH <= 0) continue
        const r = ovW * ovH / Math.min(a.w * a.h, b.w * b.h)
        if (r > maxOv) maxOv = r
        // 斥力方向：两卡中心连线（中心重叠时用确定性随机方向散开）
        let dx = a.x + a.w / 2 - (b.x + b.w / 2)
        let dy = a.y + a.h / 2 - (b.y + b.h / 2)
        let len = Math.hypot(dx, dy)
        if (len < 1e-3) {
          dx = rnd(i + j, 3) - 0.5
          dy = rnd(i + j, 7) - 0.5
          len = Math.hypot(dx, dy) || 1
        }
        dx /= len
        dy /= len
        const f = r * 4
        fx[i] += dx * f
        fy[i] += dy * f
        fx[j] -= dx * f
        fy[j] -= dy * f
      }
    }
    // 应用合力（带阻尼）+ 边界弹簧 + 夹回边界
    for (let i = 0; i < n; i++) {
      const b = boxes[i]
      if (b.x < 4) fx[i] += (4 - b.x) * 0.05
      if (b.x + b.w > vw - 4) fx[i] -= (b.x + b.w - vw + 4) * 0.05
      if (b.y < 2) fy[i] += (2 - b.y) * 0.05
      if (b.y + b.h > vh - 2) fy[i] -= (b.y + b.h - vh + 2) * 0.05
      b.x += fx[i] * 0.5
      b.y += fy[i] * 0.5
      b.x = Math.min(Math.max(b.x, 4), vw - b.w - 4)
      b.y = Math.min(Math.max(b.y, 2), vh - b.h - 2)
    }
    if (maxOv <= RATIO + 0.01) break
  }
}

const laid = computed(() => {
  const list = albums.value
  if (!list.length) return []
  // 卡片宽度表（与下方 CSS 断点保持一致；已整体缩小 20%，缓解堆叠遮挡）
  const small = cols.value <= 3
  const mid = cols.value === 4
  const HW = small ? [276, 216, 162] : mid ? [378, 294, 222] : [450, 348, 258]
  const VW = small ? [192, 150, 114] : mid ? [270, 210, 162] : [312, 252, 186]
  const metas = list.map((a, i) => {
    const s = sizeIdx(i)
    const cw = (a.dir === 'v' ? VW : HW)[s]
    return {
      s,
      halfW: cw / 2,
      halfH: ((a.dir === 'v' ? cw * 1.6 : cw * 0.625) + 38) / 2
    }
  })

  /* 最佳候选采样：候选点限制在「卡片不越界」的安全区内，
     选到最近已放卡距离最远的点（蓝噪声式均匀 + 随机感，无行列感） */
  const K = 24
  const placed = []
  for (let i = 0; i < list.length; i++) {
    let best = { x: 0, y: 0 }
    let bestScore = -1
    const minX = metas[i].halfW + 4
    const maxX = vw.value - metas[i].halfW - 4
    const minY = metas[i].halfH + 2
    const maxY = vh.value - metas[i].halfH - 2
    for (let k = 0; k < K; k++) {
      const x = minX + rnd(i * 37 + k, 41) * (maxX - minX)
      const y = minY + rnd(i * 37 + k, 43) * (maxY - minY)
      let score = Infinity
      for (const p of placed) {
        // 距离按视口归一，再除以两张卡的半宽和（大卡之间留更大间距，避免大卡全堆一起）
        const d = Math.hypot((x - p.x) / vw.value, (y - p.y) / vh.value)
        const sc = d / Math.max((metas[i].halfW + p.halfW) / vw.value, 0.02)
        if (sc < score) score = sc
      }
      if (placed.length === 0) score = 1
      if (score > bestScore) {
        bestScore = score
        best = { x, y }
      }
    }
    placed.push({ ...best, halfW: metas[i].halfW })
  }

  // 力导向去遮挡：把落点转成轴对齐包围盒，消除「基本被完全挡住」的重叠
  const boxes = placed.map((p, i) => ({
    x: p.x - metas[i].halfW,
    y: p.y - metas[i].halfH,
    w: metas[i].halfW * 2,
    h: metas[i].halfH * 2
  }))
  forceSeparate(boxes, vw.value, vh.value)

  const raw = list.map((a, i) => {
    const x = boxes[i].x + boxes[i].w / 2
    const y = boxes[i].y + boxes[i].h / 2
    // 落位点相对页面中心的偏移（px），供入场发散定位使用
    const ox = x - vw.value / 2
    const oy = y - vh.value / 2
    return {
      ...a,
      i,
      size: metas[i].s,
      ox,
      oy,
      rot: (rnd(i, 1) - 0.5) * 12, // 自身散落角度（收敛，减少旋转造成的遮挡）
      z: 1 + Math.floor(rnd(i, 4) * 20), // 层级差缩小，避免一张完全压住另一张
      dist: Math.hypot(ox, oy) // 距中心的距离，用于入场 stagger
    }
  })
  // 入场 delay：离中心越近越先发散，越远越后（形成「从中心向四周」的波）
  const maxDist = Math.max(...raw.map((r) => r.dist), 1)
  return raw.map((r) => ({ ...r, dly: ((r.dist / maxDist) * 0.55).toFixed(2) + 's' }))
})

/* ---- 入场：卡片从中心发散到四周 ---- */
const entered = ref(false)     // 是否开始发散（false 时卡片聚在中心）
const settled = ref(false)     // 发散完成（把 transition 切回 hover 用的快速过渡）
const leaving = ref(-1)        // 正在离场的卡片序号
const leavingPage = ref(false) // 是否整页淡出（点击相册进详情时）

function onResize() {
  syncLayout()
}

/* 从后端拉取真实相册（替换原来的 mock 示例数据） */
async function load() {
  try {
    const { data } = await api.get('/albums')
    albums.value = data.albums || []
  } catch (e) {
    console.error('加载相册失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  syncLayout()
  // 必须等数据加载完再触发「从中心发散」，否则卡片首次渲染时 entered 已是 true，
  // 会直接落在最终位置、跳过入场动画（数据加载慢时动画就「消失」了）
  await load()
  await nextTick()
  // 双 rAF：确保首帧以 .pre（聚在中心）渲染，再触发「发散到四周」
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
  // 入场过渡结束（最长 delay 0.55s + 时长 0.7s）后，把 transition 切回 hover 用的快速过渡
  setTimeout(() => {
    if (leaving.value === -1) settled.value = true
  }, 1350)
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

function openAlbum(a) {
  if (leaving.value !== -1) return
  leaving.value = a.i
  leavingPage.value = true
  setTimeout(() => router.push(`/albums/${a.id}`), 300)
}

/* 手机端列表点击：直接进详情（没有散落卡片的离场动画） */
function openAlbumMobile(a) {
  router.push(`/albums/${a.id}`)
}

/* ---- 背景雪花：淡、慢、少量，负延迟让首屏就有分布 ---- */
const snowflakes = Array.from({ length: 36 }, (_, i) => ({
  l: (rnd(i, 11) * 100).toFixed(2),        // 水平位置 %
  s: (3 + rnd(i, 12) * 5).toFixed(1),       // 直径 3~8px
  d: (16 + rnd(i, 14) * 16).toFixed(1),     // 飘落时长 16~32s
  dl: (-(rnd(i, 13) * 30)).toFixed(1),      // 负延迟，初始即分布在途中
  o: (0.18 + rnd(i, 15) * 0.32).toFixed(2), // 透明度 0.18~0.5
  sw: ((rnd(i, 16) - 0.5) * 60).toFixed(0)  // 横向摆动幅度 px
}))

function flakeStyle(s) {
  return {
    '--l': s.l,
    '--s': s.s + 'px',
    '--d': s.d + 's',
    '--dl': s.dl + 's',
    '--o': s.o,
    '--sw': s.sw + 'px'
  }
}

/* ---- 悬停高亮：JS 事件驱动 + 离开防抖，命中区域稳定不闪 ---- */
const active = ref(-1)
let leaveTimer = null

function onEnter(i) {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
  active.value = i
}

function onLeave() {
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    active.value = -1
    leaveTimer = null
  }, 90)
}

onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer)
})
</script>

<template>
  <div class="albums-page" :class="{ 'leaving-page': leavingPage }">
    <!-- 氛围光斑（粉色毛玻璃风） -->
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>

    <!-- 背景雪花：淡、慢 -->
    <div class="snow" aria-hidden="true">
      <span
        v-for="(s, i) in snowflakes"
        :key="i"
        class="flake"
        :style="flakeStyle(s)"
      ></span>
    </div>

    <!-- 悬浮返回（不占布局） -->
    <button class="back-home" @click="router.push('/')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      回首页
    </button>

    <!-- 照片桌：固定一屏，拍立得随机散落，大中小混排，不滚动（电脑端） -->
    <div v-if="!isMobile" class="photo-desk" :class="{ settled }">
      <article
        v-for="a in laid"
        :key="a.id"
        class="polaroid"
        :class="[a.dir, `s${a.size}`, { pre: !entered, active: active === a.i, leaving: leaving === a.i }]"
        :style="{
          '--tx': a.ox.toFixed(2) + 'px',
          '--ty': a.oy.toFixed(2) + 'px',
          '--rot': a.rot.toFixed(1) + 'deg',
          '--dly': a.dly,
          zIndex: a.z
        }"
        @click="openAlbum(a)"
        @mouseenter="onEnter(a.i)"
        @mouseleave="onLeave"
      >
        <img class="ph" :src="a.cover" :alt="a.name" loading="lazy" decoding="async" :style="{ aspectRatio: a.ar }" />
        <div class="cap">
          <b class="cap-name">{{ a.name }}</b>
          <span class="cap-meta">{{ a.city || '相册' }} · {{ a.count }} 张</span>
        </div>
      </article>
    </div>

    <!-- 手机端：正常上下排列的相册卡片（不做散落堆叠） -->
    <div v-else class="album-list">
      <article v-for="a in albums" :key="a.id" class="album-row" @click="openAlbumMobile(a)">
        <div class="row-thumb">
          <img v-if="a.cover" :src="a.cover" :alt="a.name" loading="lazy" decoding="async" />
        </div>
        <div class="row-info">
          <b class="row-name">{{ a.name }}</b>
          <span class="row-meta">{{ a.city || '相册' }} · {{ a.count }} 张</span>
        </div>
        <svg class="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </article>
    </div>

    <!-- 空状态：还没有相册 -->
    <div v-if="!loading && !albums.length" class="empty-tip">
      <span class="empty-emoji">🖼️</span>
      <p>还没有相册</p>
      <p class="empty-sub">打开电脑端「链接速存」→ 相册管理，添加你的第一本相册</p>
    </div>

  </div>
</template>

<style scoped>
.albums-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(165deg, #fff5fa 0%, #fdeef6 34%, #f3f6ff 72%, #eef4ff 100%);
}

/* 氛围光斑 */
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}
.glow-1 {
  width: 520px;
  height: 520px;
  top: -140px;
  left: -120px;
  background: rgba(244, 114, 182, 0.32);
}
.glow-2 {
  width: 460px;
  height: 460px;
  top: 8%;
  right: -140px;
  background: rgba(167, 139, 250, 0.26);
}
.glow-3 {
  width: 560px;
  height: 560px;
  bottom: -160px;
  left: 32%;
  background: rgba(125, 211, 252, 0.24);
}

/* 悬浮返回按钮 */
.back-home {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #9d6b86;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  padding: 8px 15px;
  border-radius: 999px;
  box-shadow: 0 4px 14px rgba(214, 74, 146, 0.15);
  transition: all 0.18s;
}
.back-home:hover {
  color: #ec4899;
  transform: translateX(-2px);
}

/* ---- 背景雪花：淡、慢、少量 ---- */
.snow {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}
.flake {
  position: absolute;
  top: -5vh;
  left: calc(var(--l) * 1%);
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  background: #ffffff;
  opacity: 0;
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.85);
  animation-name: snowfall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-duration: var(--d);
  animation-delay: var(--dl);
}
@keyframes snowfall {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  8% {
    opacity: var(--o);
  }
  50% {
    transform: translate3d(calc(var(--sw) * -0.6), 52vh, 0);
  }
  100% {
    transform: translate3d(var(--sw), 110vh, 0);
    opacity: 0;
  }
}

/* ---- 照片桌：固定一屏（100vh） ---- */
.photo-desk {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  z-index: 2;
}

/* ---- 空状态 ---- */
.empty-tip {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #b0879c;
  font-size: 15px;
  letter-spacing: 1px;
  text-align: center;
  padding: 0 24px;
}
.empty-emoji { font-size: 54px; opacity: 0.75; }
.empty-sub { font-size: 12.5px; color: #c9a2b6; }

/* 拍立得卡片：白框 + 随机角度 + 以中心为原点定位 + 大中小三档
   --tx/--ty 为静态落位偏移（相对页面中心），入场时从中心过渡发散到该位置 */
.polaroid {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--w);
  padding: 7px 7px 9px;
  background: #fffdf9;
  border-radius: 3px;
  box-shadow: 0 6px 18px rgba(90, 40, 65, 0.2);
  cursor: pointer;
  transform: translate(-50%, -50%) translate(var(--tx, 0px), var(--ty, 0px)) rotate(var(--rot, 0deg));
  transform-origin: center;
  opacity: 1;
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--dly, 0s),
              opacity 0.65s ease var(--dly, 0s),
              box-shadow 0.22s ease;
  will-change: transform, opacity;
}

/* 大中小三档（横卡；与 JS 里的宽度表保持一致，已整体缩小 20%） */
.polaroid.s0 { --w: 450px; }
.polaroid.s1 { --w: 348px; }
.polaroid.s2 { --w: 258px; }
/* 竖卡相应收窄 */
.polaroid.v.s0 { --w: 312px; }
.polaroid.v.s1 { --w: 252px; }
.polaroid.v.s2 { --w: 186px; }

.polaroid.active {
  /* 突出：围绕自身中心放大 + 刚体上浮 + 盖顶 */
  transform: translate(-50%, -50%) translate(var(--tx, 0px), var(--ty, 0px)) rotate(var(--rot, 0deg)) translateY(-10px) scale(1.12);
  z-index: 999 !important; /* 覆盖 inline 随机 z */
  box-shadow: 0 24px 50px rgba(90, 40, 65, 0.38);
}

/* 入场前：卡片聚在中心、缩小、透明（随后过渡发散到四周） */
.polaroid.pre {
  transform: translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(0.12);
  opacity: 0;
}

/* 发散完成：切回 hover 用的平滑过渡（去回弹曲线，transform 与阴影同步时长，凸显更丝滑） */
.photo-desk.settled .polaroid {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}

/* 点击离开：被点卡片放大淡出 */
.polaroid.leaving {
  transform: translate(-50%, -50%) translate(var(--tx, 0px), var(--ty, 0px)) rotate(var(--rot, 0deg)) scale(1.16);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease !important;
  z-index: 1000 !important;
}
/* 点击离开时，其余卡片同步淡出 */
.albums-page.leaving-page .polaroid:not(.leaving) {
  opacity: 0;
  transition: opacity 0.26s ease !important;
}

.ph {
  display: block;
  width: 100%;
  background: #f0e2e9;
  border-radius: 2px;
  /* 图片底部轻轻淡入白底，消除与下方手写区的生硬分界 */
  -webkit-mask-image: linear-gradient(to bottom, #000 88%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 88%, transparent 100%);
}

/* 拍立得白边手写区：标题在左、信息在右，单行横排 */
.cap {
  padding: 4px 6px 2px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cap-name {
  font-family: 'Kaiti SC', 'KaiTi', 'STKaiti', cursive, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #4a3340;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cap-meta {
  font-size: 10px;
  color: #b294a3;
  flex-shrink: 0;
  white-space: nowrap;
}
.polaroid.s0 .cap-name { font-size: 15px; }
.polaroid.s0 .cap-meta { font-size: 11px; }
.polaroid.s2 .cap-name { font-size: 11px; }
.polaroid.s2 .cap-meta { font-size: 9px; }

/* 断点：卡片档位随屏幕缩放（与 JS 宽度表一致），行距由 100vh 自动均分 */
@media (max-width: 1100px) {
  .polaroid.s0 { --w: 378px; }
  .polaroid.s1 { --w: 294px; }
  .polaroid.s2 { --w: 222px; }
  .polaroid.v.s0 { --w: 270px; }
  .polaroid.v.s1 { --w: 210px; }
  .polaroid.v.s2 { --w: 162px; }
}
@media (max-width: 768px) {
  .polaroid { padding: 5px 5px 7px; }
  .polaroid.s0 { --w: 276px; }
  .polaroid.s1 { --w: 216px; }
  .polaroid.s2 { --w: 162px; }
  .polaroid.v.s0 { --w: 192px; }
  .polaroid.v.s1 { --w: 150px; }
  .polaroid.v.s2 { --w: 114px; }
  .cap { padding-top: 3px; }
  .cap-name { font-size: 12px; }
  .cap-meta { font-size: 9px; }
  .polaroid.s0 .cap-name { font-size: 14px; }
  .polaroid.s0 .cap-meta { font-size: 10px; }
  .polaroid.s2 .cap-name { font-size: 10px; }
  .polaroid.s2 .cap-meta { font-size: 8.5px; }
}

/* 暗色模式适配 */
.dark .albums-page {
  background: linear-gradient(165deg, #1c1420 0%, #241726 34%, #171b2c 72%, #141a29 100%);
}
.dark .glow-1 { background: rgba(236, 72, 153, 0.22); }
.dark .glow-2 { background: rgba(139, 92, 246, 0.2); }
.dark .glow-3 { background: rgba(59, 130, 246, 0.18); }
.dark .back-home {
  color: #d8a8bf;
  background: rgba(40, 28, 38, 0.7);
  border-color: rgba(255, 255, 255, 0.14);
}
.dark .back-home:hover { color: #f9a8d4; }
.dark .polaroid {
  background: #f5edf2;
}
.dark .flake {
  background: #eef2ff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}
.dark .empty-tip { color: #9d7f90; }
.dark .empty-sub { color: #7c6270; }

/* =====================================================================
   手机端：正常上下排列的相册卡片（一屏散落会互相遮挡，这里直接列出来）
   ===================================================================== */
.album-list {
  position: relative;
  z-index: 2;
  padding: 68px 16px 130px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.album-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px;
  border-radius: 16px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(214, 74, 146, 0.1);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.album-row:active {
  transform: scale(0.985);
}
.row-thumb {
  width: 104px;
  height: 104px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: #f0e2e9;
}
.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row-name {
  font-size: 16px;
  font-weight: 700;
  color: #4a3340;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-meta {
  font-size: 12.5px;
  color: #b294a3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-arrow {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #d9b3c7;
}

/* 手机端整页可滚动（电脑端是一屏固定） */
@media (max-width: 639px) {
  .albums-page {
    height: auto;
    min-height: 100vh;
    /* 裁剪超宽的光斑（glow 是 absolute 定位，横向溢出会把页面撑出横向滚动条） */
    overflow-x: hidden;
    overflow-y: auto;
  }
  .empty-tip {
    position: static;
    padding: 120px 24px 0;
  }
}

.dark .album-row {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}
.dark .row-thumb { background: rgba(255, 255, 255, 0.08); }
.dark .row-name { color: #f3e8ef; }
.dark .row-meta { color: #a8859a; }
.dark .row-arrow { color: #7c6270; }
</style>
