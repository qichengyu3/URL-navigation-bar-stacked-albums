<template>
  <router-view />
  <!-- 全局音乐播放器：相册列表/详情页显示，路由切换不断播 -->
  <MusicPlayer />
</template>

<script setup>
import MusicPlayer from './components/MusicPlayer.vue'
</script>
