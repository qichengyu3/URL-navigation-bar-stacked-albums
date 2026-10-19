<template>
  <!-- 全局音乐播放器：固定在底部，相册列表/详情页都显示，切换路由不中断 -->
  <div v-show="visible" class="music-bar">
    <button class="mb-play" @click="onToggle" :title="playing ? '暂停' : '播放'">
      <svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    </button>

    <div class="mb-info">
      <div class="mb-title">{{ SONG.title }}</div>
      <div class="mb-track">
        <div class="mb-fill" :style="{ width: (dur ? (cur / dur) * 100 : 0) + '%' }"></div>
        <input
          class="mb-range"
          type="range"
          min="0"
          :max="dur || 0"
          step="0.1"
          :value="cur"
          @input="onSeek"
        />
      </div>
    </div>

    <span class="mb-time" v-if="!audioErr">{{ fmt(cur) }} / {{ fmt(dur) }}</span>
    <span class="mb-time mb-err" v-else>加载失败</span>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMusic, fmt, loadSongConfig } from '../composables/useMusic'

const route = useRoute()
const { SONG, playing, cur, dur, audioErr, play, pause, toggle, seek } = useMusic()

// 拉取后台配置的曲目（标题/链接），失败则沿用默认曲目
loadSongConfig()

// 只在相册列表页 / 相册详情页显示
const visible = computed(() => route.name === 'Albums' || route.name === 'AlbumDetail')

// 用户手动暂停后，停留在相册页内不自动续播；离开相册页再回来才恢复自动播放
let userPaused = false

function onToggle() {
  if (playing.value) {
    userPaused = true
    pause()
  } else {
    userPaused = false
    play()
  }
}

function onSeek(e) {
  seek(Number(e.target.value))
}

watch(
  visible,
  (v) => {
    if (v) {
      // 进入相册页：没被用户手动暂停就自动续播（列表↔详情切换不会触发，保持原状态）
      if (!userPaused) play()
    } else {
      // 离开相册页：暂停，避免音乐跑到首页/后台还在响
      pause()
      userPaused = false
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* ---- 底部音乐播放器：水珠透明效果（多层内阴影营造水体体积 + 高光点 + 水波动画） ---- */
.music-bar {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  width: 33vw;
  min-width: 340px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.24) 100%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 8px 12px 22px rgba(180, 120, 150, 0.18),
    inset -10px -14px 26px rgba(255, 255, 255, 0.95),
    0 12px 30px rgba(90, 40, 65, 0.2);
  z-index: 1005;
  animation: bar-wave 5s ease-in-out infinite alternate;
}
.music-bar::before {
  content: '';
  position: absolute;
  left: 6%;
  right: 6%;
  top: 2px;
  height: 50%;
  z-index: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
  border-radius: 50%;
  filter: blur(2px);
  pointer-events: none;
  animation: bar-shine 4s ease-in-out infinite alternate;
}
.music-bar::after {
  content: '';
  position: absolute;
  top: 18%;
  left: 14%;
  width: 7px;
  height: 7px;
  z-index: 0;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 46% 54% 36% 64% / 46% 43% 57% 54%;
  pointer-events: none;
  animation: bar-drop 3.5s ease-in-out infinite alternate;
}
@keyframes bar-wave {
  0% { border-radius: 999px; }
  100% { border-radius: 130px 999px 130px 999px / 999px 150px 999px 150px; }
}
@keyframes bar-shine {
  0% { top: 2px; opacity: 0.85; }
  100% { top: 4px; opacity: 1; }
}
@keyframes bar-drop {
  0% { top: 15%; left: 12%; }
  100% { top: 22%; left: 17%; }
}
.mb-play {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #ec4899, #a78bfa);
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.35);
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
}
.mb-play:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(236, 72, 153, 0.45);
}
.mb-play svg { width: 17px; height: 17px; }
.mb-info {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mb-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #4a3340;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mb-track {
  position: relative;
  height: 14px;
  display: flex;
  align-items: center;
}
.mb-track::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  background: rgba(157, 107, 134, 0.22);
  border-radius: 99px;
}
.mb-fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 99px;
  background: linear-gradient(90deg, #ec4899, #a78bfa);
  pointer-events: none;
}
.mb-range {
  position: relative;
  width: 100%;
  height: 14px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.mb-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.35);
}
.mb-time {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  font-size: 11px;
  color: #9d6b86;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mb-err { color: #e11d48; }

@media (max-width: 768px) {
  .music-bar {
    width: 82vw;
    min-width: 0;
    bottom: 14px;
    padding: 8px 14px;
  }
}

/* 暗色模式：水体暗色版 */
.dark .music-bar {
  background: linear-gradient(180deg, rgba(120, 92, 128, 0.45) 0%, rgba(40, 28, 38, 0.25) 45%, rgba(70, 48, 62, 0.38) 100%);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 8px 12px 22px rgba(0, 0, 0, 0.4),
    inset -10px -14px 26px rgba(255, 255, 255, 0.16),
    0 12px 30px rgba(0, 0, 0, 0.45);
}
.dark .music-bar::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0));
}
.dark .music-bar::after {
  background: rgba(255, 255, 255, 0.4);
}
.dark .mb-title { color: #f0dce7; }
.dark .mb-time { color: #d8a8bf; }
.dark .mb-track::before { background: rgba(255, 255, 255, 0.16); }
.dark .mb-range::-webkit-slider-thumb { background: #f5edf2; }
</style>
