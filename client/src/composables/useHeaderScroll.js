import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 页眉滚动收缩：通栏 ⇄ 胶囊
 * ---------------------------------------------------------------------------
 * 迟滞逻辑（移植自 nav-kit/useHeaderScroll.js）：
 *
 *  · 进 / 出用两个不同阈值（48 / 16），中间是死区 —— 阈值附近轻微滚动不会反复翻转，
 *    页眉不会一抽一抽地抖
 *  · 展开必须**同时**满足「已回到 16px 以内」和「方向向上」，避免刚往下滚几像素
 *    就闪回全宽
 *  · armGuard()：站内跳转会把页面拉回顶部并触发一次 scroll，
 *    这次不算「用户往上滑」，保持跳转前的形态
 */
const SCROLLED_ENTER = 48
const SCROLLED_EXIT = 16
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown']

export function useHeaderScroll() {
  const scrolled = ref(false)

  let lastY = 0
  let navGuard = false

  function onScroll() {
    const y = window.scrollY
    const goingUp = y < lastY
    lastY = y

    if (navGuard) {
      if (y < SCROLLED_ENTER) return
      navGuard = false
    }

    if (scrolled.value) {
      if (y < SCROLLED_EXIT && goingUp) scrolled.value = false
    } else if (y > SCROLLED_ENTER) {
      scrolled.value = true
    }
  }

  /**
   * 用户产生了滚动输入 → 揭开 guard。
   * 顺带兜住：页面内容不够长、根本不能滚动时不会有 scroll 事件，
   * 这里直接恢复全宽，避免页眉永远卡在胶囊态。
   */
  function onUserScrollInput() {
    if (!navGuard) return
    navGuard = false
    if (document.documentElement.scrollHeight <= window.innerHeight + 2) scrolled.value = false
  }

  /** 站内跳转前调用：忽略接下来那次「回到顶部」的 scroll */
  function armGuard() {
    navGuard = true
  }

  onMounted(() => {
    lastY = window.scrollY
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    USER_SCROLL_EVENTS.forEach((e) => window.addEventListener(e, onUserScrollInput, { passive: true }))
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    USER_SCROLL_EVENTS.forEach((e) => window.removeEventListener(e, onUserScrollInput))
  })

  return { scrolled, armGuard }
}
