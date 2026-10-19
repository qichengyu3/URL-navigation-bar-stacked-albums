<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const route = useRoute()

const albumId = computed(() => Number(route.params.id))
const album = ref(null)
const photos = ref([])
const count = computed(() => album.value?.count ?? photos.value.length)
const notFound = ref(false)

onMounted(async () => {
  try {
    const { data } = await api.get(`/albums/${albumId.value}`)
    album.value = data.album
    photos.value = (data.album.photos || []).map((p) => ({
      ...p,
      // 瀑布流用缩略图（thumb），点开灯箱才加载大图（url）——省流量
      src: p.thumb || p.url,
      ar: p.ar || (p.width && p.height ? `${p.width} / ${p.height}` : '16 / 9')
    }))
  } catch (e) {
    console.error('加载相册失败', e)
    notFound.value = true
  }
})

// 灯箱：点击放大居中 + 上一张/下一张
const lightbox = ref(-1)
const cur = computed(() => (lightbox.value >= 0 ? photos.value[lightbox.value] : null))
// 灯箱内旋转 / 缩放（切图时复位）
const rotation = ref(0)
const scale = ref(1)
function open(i) { lightbox.value = i; resetView() }
function close() { lightbox.value = -1 }
function prev() { lightbox.value = (lightbox.value - 1 + photos.value.length) % photos.value.length; resetView() }
function next() { lightbox.value = (lightbox.value + 1) % photos.value.length; resetView() }
function resetView() { rotation.value = 0; scale.value = 1 }
function rotate() { rotation.value = (rotation.value + 90) % 360 }
function zoomIn() { scale.value = Math.min(scale.value + 0.25, 4) }
function zoomOut() { scale.value = Math.max(scale.value - 0.25, 0.5) }
function resetZoom() { scale.value = 1 }
function onKey(e) {
  if (lightbox.value < 0) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="album-detail-page">
    <!-- 氛围光斑 -->
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>

    <!-- 标题区 -->
    <header class="detail-head">
      <button class="back-btn" @click="router.push('/albums')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回相册
      </button>
      <h1 class="detail-title">{{ album?.name || '' }}</h1>
      <p class="detail-sub">
        <template v-if="album?.desc">{{ album.desc }} · </template>共 {{ count }} 张
      </p>
    </header>

    <!-- 相册不存在 / 加载失败 -->
    <div v-if="notFound" class="empty-detail">
      <span class="empty-emoji">🖼️</span>
      <p>相册不存在或已删除</p>
    </div>

    <!-- 瀑布流（CSS columns 实现，无需 JS 计算） -->
    <div v-else class="masonry">
      <figure
        v-for="(p, i) in photos"
        :key="p.id"
        class="photo-card"
        :style="{ '--dly': Math.min(i, 10) * 0.045 + 's' }"
      >
        <img
          :src="p.src"
          :alt="p.title"
          loading="lazy"
          decoding="async"
          :style="{ aspectRatio: p.ar }"
          @click="open(i)"
        />
      </figure>
    </div>

    <p v-if="album" class="end-tip">~~ 到底啦 ~~</p>

    <!-- 灯箱：点击放大居中，左右切换上一张/下一张 -->
    <transition name="lb">
      <div v-if="cur" class="lightbox" @click.self="close">
        <button class="lb-close" @click="close" aria-label="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <button class="lb-nav lb-prev" @click="prev" aria-label="上一张">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <img
          class="lb-img"
          :class="{ 'is-rot': rotation % 180 !== 0 }"
          :style="{ transform: `rotate(${rotation}deg) scale(${scale})` }"
          :src="cur.url"
          :alt="cur.title"
          @dblclick="resetZoom"
        />
        <button class="lb-nav lb-next" @click="next" aria-label="下一张">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <span class="lb-count">{{ lightbox + 1 }} / {{ photos.length }}</span>

        <!-- 工具栏：旋转（两端）+ 缩放（仅电脑端） -->
        <div class="lb-tools" @click.stop>
          <button class="lb-tool" @click="rotate" title="旋转 90°" aria-label="旋转">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button class="lb-tool lb-zoom" @click="zoomOut" title="缩小" aria-label="缩小">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button class="lb-tool lb-pct" @click="resetZoom" :title="'重置缩放'" aria-label="重置缩放">{{ Math.round(scale * 100) }}%</button>
          <button class="lb-tool lb-zoom" @click="zoomIn" title="放大" aria-label="放大">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.album-detail-page {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(165deg, #fff5fa 0%, #fdeef6 34%, #f3f6ff 72%, #eef4ff 100%);
  overflow-x: hidden;
}

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
  background: rgba(244, 114, 182, 0.3);
}
.glow-2 {
  width: 460px;
  height: 460px;
  top: 20%;
  right: -140px;
  background: rgba(167, 139, 250, 0.24);
}
.glow-3 {
  width: 560px;
  height: 560px;
  bottom: -180px;
  left: 30%;
  background: rgba(125, 211, 252, 0.22);
}

/* 标题区 */
.detail-head {
  position: relative;
  text-align: center;
  padding: 76px 20px 6px;
  animation: headIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes headIn {
  from { opacity: 0; transform: translateY(-22px); }
  to   { opacity: 1; transform: translateY(0); }
}
.back-btn {
  position: absolute;
  top: 22px;
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #9d6b86;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  padding: 7px 14px;
  border-radius: 999px;
  box-shadow: 0 4px 14px rgba(214, 74, 146, 0.12);
  transition: all 0.18s;
}
.back-btn:hover {
  color: #ec4899;
  transform: translateX(-2px);
}
.detail-title {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 2px;
  background: linear-gradient(120deg, #ec4899, #d946ef 55%, #8b5cf6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.detail-sub {
  margin-top: 8px;
  font-size: 13.5px;
  color: #b0879c;
}

/* 相册不存在空状态 */
.empty-detail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 120px 24px;
  color: #b0879c;
  font-size: 15px;
  letter-spacing: 1px;
}
.empty-detail .empty-emoji { font-size: 54px; opacity: 0.75; }

/* 瀑布流（CSS columns 实现，无需 JS 计算） */
.masonry {
  position: relative;
  width: 90%;
  max-width: none;
  margin: 0 auto;
  padding: 30px 0 10px;
  column-count: 1;
  column-gap: 22px;
}
@media (min-width: 560px) {
  .masonry { column-count: 2; }
}
/* 桌面端保持 3 列（不再 4 列），单张图片更大更舒展 */
@media (min-width: 900px) {
  .masonry { column-count: 3; }
}

.photo-card {
  break-inside: avoid;
  margin: 0 0 18px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(214, 74, 146, 0.12);
  cursor: zoom-in;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  animation: photoIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: var(--dly, 0s);
}
@keyframes photoIn {
  from { opacity: 0; transform: translateY(26px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.photo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 36px rgba(214, 74, 146, 0.2);
}
.photo-card img {
  width: 100%;
  display: block;
  background: #f6e3ec;
}

.end-tip {
  position: relative;
  text-align: center;
  /* 底部留出播放器高度，避免「到底啦」被固定播放器盖住 */
  padding: 26px 0 104px;
  font-size: 13px;
  color: #c9a2b6;
  letter-spacing: 2px;
  animation: photoIn 0.5s ease backwards;
  animation-delay: 0.42s;
}

/* ---- 灯箱：点击放大居中 + 左右切换 ---- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 12, 20, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: zoom-out;
  overflow: hidden;
}
.lb-img {
  max-width: 88vw;
  max-height: 84vh;
  border-radius: 12px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  object-fit: contain;
  transform-origin: center;
  transition: transform 0.25s ease;
  will-change: transform;
}
/* 电脑端灯箱图片更大 */
@media (min-width: 640px) {
  .lb-img { max-width: 92vw; max-height: 90vh; }
}
/* 旋转 90°/270° 时交换宽高约束，避免溢出屏幕 */
.lb-img.is-rot { max-width: 84vh; max-height: 88vw; }
@media (min-width: 640px) {
  .lb-img.is-rot { max-width: 90vh; max-height: 92vw; }
}
.lb-close {
  position: absolute;
  top: 22px;
  right: 26px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  cursor: pointer;
  transition: background 0.18s, transform 0.18s;
}
.lb-close:hover { background: rgba(255, 255, 255, 0.3); transform: rotate(90deg); }
.lb-close svg { width: 20px; height: 20px; }
.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: background 0.18s, transform 0.18s;
}
.lb-nav:hover { background: rgba(255, 255, 255, 0.28); }
.lb-nav svg { width: 26px; height: 26px; }
.lb-prev { left: 24px; }
.lb-prev:hover { transform: translateY(-50%) translateX(-2px); }
.lb-next { right: 24px; }
.lb-next:hover { transform: translateY(-50%) translateX(2px); }
.lb-count {
  position: absolute;
  top: 30px;
  left: 26px;
  font-size: 14px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
}

/* 底部工具栏：旋转（两端）+ 缩放（仅电脑端） */
.lb-tools {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.lb-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.lb-tool:hover { background: rgba(255, 255, 255, 0.28); }
.lb-tool svg { width: 18px; height: 18px; }
.lb-pct {
  width: auto;
  min-width: 44px;
  padding: 0 8px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  border-radius: 999px;
}
/* 缩放按钮默认隐藏，仅电脑端显示 */
.lb-zoom { display: none; }
@media (min-width: 640px) {
  .lb-zoom { display: inline-flex; }
}

/* 灯箱过渡 */
.lb-enter-active, .lb-leave-active { transition: opacity 0.22s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }

/* 暗色模式 */
.dark .album-detail-page {
  background: linear-gradient(165deg, #1c1420 0%, #241726 34%, #171b2c 72%, #141a29 100%);
}
.dark .glow-1 { background: rgba(236, 72, 153, 0.22); }
.dark .glow-2 { background: rgba(139, 92, 246, 0.2); }
.dark .glow-3 { background: rgba(59, 130, 246, 0.18); }
.dark .back-btn {
  color: #d8a8bf;
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
}
.dark .back-btn:hover { color: #f9a8d4; }
.dark .detail-sub { color: #9d7f90; }
.dark .photo-card {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.dark .end-tip { color: #7c6270; }
.dark .empty-detail { color: #9d7f90; }
</style>
