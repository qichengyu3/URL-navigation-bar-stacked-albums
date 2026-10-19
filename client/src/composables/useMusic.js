import { ref, reactive } from 'vue'
import { api } from '../api'

/* 默认曲目：后台「设置 → 背景音乐」没配置时用它兜底。
   这里放的是公开的示例音频，正式使用请在后台换成自己的音乐地址。 */
const DEFAULT_SONG = {
  title: '示例音乐（可在后台更换）',
  src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}

/* 后台可改的曲目信息：响应式，改名/换链接后播放器 UI 实时更新 */
export const SONG = reactive({ ...DEFAULT_SONG })

/* ---- 模块级单例 ----
   整个应用只创建一个 Audio 实例（挂在模块作用域，不随组件卸载销毁），
   这样从相册列表跳到相册详情时播放不会中断，进度也接着走。 */
let audio = null

const playing = ref(false)
const cur = ref(0)
const dur = ref(0)
const audioErr = ref(false)
const ready = ref(false)

/* 音乐配置只拉一次（公开设置接口，无需登录）。失败就继续用默认曲目，不阻塞播放 */
let songConfigLoaded = false
let songConfigPromise = null

export function loadSongConfig() {
  if (songConfigLoaded) return Promise.resolve()
  if (songConfigPromise) return songConfigPromise
  songConfigPromise = api
    .get('/settings')
    .then(({ data }) => {
      const title = (data && data['music.title']) || ''
      const url = (data && data['music.url']) || ''
      if (title) SONG.title = title
      if (url && url !== SONG.src) {
        SONG.src = url
        // 播放器已创建时同步换源：保留「正在播」的状态，避免换完变成暂停
        if (audio) {
          const wasPlaying = !audio.paused
          audio.src = url
          audio.load()
          if (wasPlaying) audio.play().catch(() => {})
        }
      }
    })
    .catch(() => {
      /* 拉取失败保持默认曲目 */
    })
    .finally(() => {
      songConfigLoaded = true
    })
  return songConfigPromise
}

function ensureAudio() {
  if (audio) return audio
  const a = new Audio()
  a.src = SONG.src
  a.preload = 'auto'
  a.loop = true
  a.addEventListener('timeupdate', () => {
    cur.value = a.currentTime
  })
  a.addEventListener('loadedmetadata', () => {
    if (isFinite(a.duration)) dur.value = a.duration
  })
  a.addEventListener('durationchange', () => {
    if (isFinite(a.duration)) dur.value = a.duration
  })
  a.addEventListener('canplay', () => {
    ready.value = true
  })
  a.addEventListener('play', () => {
    playing.value = true
    audioErr.value = false
  })
  a.addEventListener('pause', () => {
    playing.value = false
  })
  a.addEventListener('ended', () => {
    playing.value = false
  })
  a.addEventListener('error', () => {
    audioErr.value = true
    playing.value = false
  })
  audio = a
  return a
}

export function fmt(t) {
  if (!t || !isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}

export function useMusic() {
  // 懒创建：只有真正需要播放时才 new Audio()，
  // 避免一进首页就为 46MB 的 flac 白跑流量
  function play() {
    const a = ensureAudio()
    // 自动播放可能被浏览器策略拦截，静默失败即可（用户点一下就能播）
    const p = a.play()
    if (p && p.catch) p.catch(() => {})
  }
  function pause() {
    if (audio) audio.pause()
  }
  function toggle() {
    if (!audio) return play()
    audio.paused ? play() : pause()
  }
  function seek(t) {
    if (!audio || !isFinite(t)) return
    audio.currentTime = Math.max(0, Math.min(t, dur.value || t))
  }
  function seekBy(ratio) {
    if (dur.value) seek(dur.value * ratio)
  }

  return { SONG, playing, cur, dur, audioErr, ready, play, pause, toggle, seek, seekBy }
}
