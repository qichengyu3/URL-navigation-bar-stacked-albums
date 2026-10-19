<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-20 h-20 bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span class="text-white text-3xl font-bold">T</span>
        </div>
        <h1 class="text-2xl font-bold text-slate-800">TabHub 管理后台</h1>
        <p class="text-slate-500 mt-2">请登录以继续</p>
      </div>

      <div class="bg-white rounded-2xl shadow-xl p-8">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="用户名"
              size="large"
              :prefix-icon="User"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              size="large"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="w-full"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form>

        <p class="text-center text-sm text-slate-400 mt-4">
          本站为个人站点，未开放注册
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)

const form = ref({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true

    try {
      await authStore.login(form.value.username, form.value.password)
      ElMessage.success('登录成功')
      router.push('/admin')
    } catch (err) {
      ElMessage.error(err.response?.data?.error || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>
