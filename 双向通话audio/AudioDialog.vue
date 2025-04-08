<script setup>
import { Button as AButton, message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref, toRefs, unref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import UmDialog from '@/components/umDialog/Index.vue'
import * as UUID from '~/hooks/uuid'
import { useUserStore } from '~/stores/user'
import { endVoice, startVoice } from '@/api/customs/lamp/index'

// 定义props
const props = defineProps({
  deviceId: {
    type: String,
    default: '',
  },
  visible: {
    type: Boolean,
    default: false,
  },
})
const { deviceId } = toRefs(props)
const sessionId = ref(UUID.getUUID())
const isRecording = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

const emits = defineEmits(['update:visible', 'error'])
const visible = useVModel(props, 'visible', emits)

const userStore = useUserStore()
const { token, userData } = storeToRefs(userStore)

// 响应式状态
const ws = ref(null)
const mediaSource = ref(null)
const sourceBuffer = ref(null)
const mediaRecorder = ref(null)
const bufferQueue = ref([])
const audio = ref(null)

const getWebsocketUri = () => {
  const uid = String(unref(userData)?.id ?? '不存在的uid')
  return import.meta.env.DEV
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://172.16.18.171:8991/ws/${uid}/${sessionId.value}`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${uid}/${sessionId.value}`
}

// 错误处理函数
const handleError = (error, customMessage) => {
  console.error(customMessage, error)
  errorMessage.value = customMessage
  hasError.value = true
  emits('error', { message: customMessage, error })
  message.error(customMessage)
}

// 检查麦克风权限和兼容性
function checkMediaDevices() {
  if (!navigator.mediaDevices?.getUserMedia) {
    // 旧版浏览器可能需要使用 getUserMedia 的前缀版本
    navigator.mediaDevices = {}
    navigator.mediaDevices.getUserMedia = function (constraints) {
      const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia 不被支持'))
      }
      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject)
      })
    }
  }
}

// 初始化WebSocket
function initializeWebSocket() {
  try {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.close()
    }

    ws.value = new WebSocket(getWebsocketUri())
    ws.value.binaryType = 'arraybuffer'

    ws.value.onopen = () => {
      console.log('WebSocket connection established')
    }

    ws.value.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const data = new Uint8Array(event.data)
        // 确保 MediaSource 和 SourceBuffer 都处于可用状态
        if (!mediaSource.value || mediaSource.value.readyState !== 'open') {
          console.warn('MediaSource not ready, queuing data')
          bufferQueue.value.push(data)
          return
        }

        if (!sourceBuffer.value) {
          console.warn('SourceBuffer not ready, queuing data')
          bufferQueue.value.push(data)
          return
        }

        if (sourceBuffer.value.updating) {
          bufferQueue.value.push(data)
          return
        }

        try {
          if (data.length > 0) {
            sourceBuffer.value.appendBuffer(data)

            // 确保音频开始播放
            if (audio.value && audio.value.paused) {
              audio.value.play().catch((err) => {
                console.error('Audio play error:', err)
              })
            }
          }
        }
        catch (e) {
          console.error('Append buffer error:', e)
          // 如果是格式错误，尝试重置 MediaSource
          if (e.name === 'QuotaExceededError') {
            // 如果是缓冲区已满，先清除一些旧数据
            try {
              const buffered = sourceBuffer.value.buffered
              if (buffered.length > 0) {
                sourceBuffer.value.remove(0, buffered.end(0) - 3) // 保留最后3秒
              }
            }
            catch (removeError) {
              console.error('Buffer removal error:', removeError)
              resetMediaSource()
            }
          }
          else {
            bufferQueue.value.push(data)
            resetMediaSource()
          }
        }
      }
    }

    ws.value.onerror = (error) => {
      handleError(error, 'WebSocket 连接错误')
    }

    ws.value.onclose = () => {
      console.log('WebSocket connection closed')
      if (isRecording.value) {
        handleError(new Error('WebSocket connection closed unexpectedly'), '连接已断开，请重试')
        stopRecording()
      }
    }
  }
  catch (error) {
    handleError(error, 'WebSocket 初始化失败')
  }
}

// 初始化MediaSource
function initializeMediaSource() {
  try {
    if (mediaSource.value) {
      if (mediaSource.value.readyState === 'open') {
        try {
          mediaSource.value.endOfStream()
        }
        catch (e) {
          console.error('End of stream error:', e)
        }
      }

      // 保存旧的 URL，等新的 URL 创建后再回收
      const oldUrl = audio.value.src

      // 创建新的 MediaSource 和 URL
      mediaSource.value = new MediaSource()
      const newUrl = URL.createObjectURL(mediaSource.value)
      audio.value.src = newUrl

      // 回收旧的 URL
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl)
        }
        catch (e) {
          console.error('URL revoke error:', e)
        }
      }
    }
    else {
      mediaSource.value = new MediaSource()
      audio.value.src = URL.createObjectURL(mediaSource.value)
    }

    mediaSource.value.addEventListener('sourceopen', () => {
      console.log('MediaSource opened successfully')
      if (!sourceBuffer.value && mediaSource.value.readyState === 'open') {
        try {
          sourceBuffer.value = mediaSource.value.addSourceBuffer('audio/webm; codecs=opus')
          sourceBuffer.value.mode = 'sequence'

          sourceBuffer.value.addEventListener('updateend', () => {
            if (bufferQueue.value.length > 0 && !sourceBuffer.value.updating) {
              const data = bufferQueue.value.shift()
              try {
                if (mediaSource.value.readyState === 'open') {
                  sourceBuffer.value.appendBuffer(data)

                  // 确保音频开始播放
                  if (audio.value && audio.value.paused) {
                    audio.value.play().catch((err) => {
                      console.error('Audio play error:', err)
                    })
                  }
                }
              }
              catch (e) {
                console.error('Buffer update error:', e)
                if (e.name === 'QuotaExceededError') {
                  try {
                    const buffered = sourceBuffer.value.buffered
                    if (buffered.length > 0) {
                      sourceBuffer.value.remove(0, buffered.end(0) - 3)
                    }
                  }
                  catch (removeError) {
                    console.error('Buffer removal error:', removeError)
                    resetMediaSource()
                  }
                }
                else {
                  resetMediaSource()
                }
              }
            }
          })
        }
        catch (e) {
          console.error('Add source buffer error:', e)
          handleError(e, '音频初始化失败')
        }
      }
    })
  }
  catch (error) {
    console.error('Initialize MediaSource error:', error)
    handleError(error, '音频初始化失败')
  }
}

// 重置MediaSource
function resetMediaSource() {
  try {
    // 保存当前的 URL
    const currentUrl = audio.value.src

    if (sourceBuffer.value) {
      if (mediaSource.value.readyState === 'open') {
        try {
          if (!sourceBuffer.value.updating) {
            mediaSource.value.removeSourceBuffer(sourceBuffer.value)
          }
        }
        catch (e) {
          console.error('Remove source buffer error:', e)
        }
      }
      sourceBuffer.value = null
    }

    bufferQueue.value = []

    if (mediaSource.value && mediaSource.value.readyState === 'open') {
      try {
        mediaSource.value.endOfStream()
      }
      catch (e) {
        console.error('End of stream error:', e)
      }
    }

    // 确保在创建新的 MediaSource 之前不会清空 src
    setTimeout(() => {
      // 只有在当前 URL 仍然是重置开始时的 URL 时才进行初始化
      if (audio.value.src === currentUrl) {
        initializeMediaSource()
      }
    }, 200)
  }
  catch (e) {
    console.error('Reset media source error:', e)
  }
}

// 开始录音
async function startRecording() {
  try {
    if (isRecording.value) {
      return
    }

    checkMediaDevices()
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    mediaRecorder.value = new MediaRecorder(stream, {
      mimeType: 'audio/webm; codecs=opus',
      audioBitsPerSecond: 128000, // 设置音频比特率为 128kbps
    })

    mediaRecorder.value.ondataavailable = async (event) => {
      if (event.data.size > 0 && ws.value?.readyState === WebSocket.OPEN) {
        try {
          const buffer = await event.data.arrayBuffer()
          ws.value.send(buffer)
        }
        catch (error) {
          handleError(error, '音频数据处理失败')
        }
      }
    }

    mediaRecorder.value.onerror = (error) => {
      handleError(error, '录音出错，请重试')
    }

    // 开始录制
    mediaRecorder.value.start(100)
    isRecording.value = true
  }
  catch (error) {
    handleError(error, '获取麦克风权限失败，请确保允许浏览器使用麦克风')
  }
}

// 喊话接口
async function openStartDialog() {
  try {
    await startVoice({ deviceId: deviceId.value, sessionId: sessionId.value })
    message.success('开始喊话')
    await startRecording()
  }
  catch (error) {
    console.error('开始喊话失败:', error)
    message.error('开始喊话失败，请重试')
    visible.value = false
  }
}

watch(
  () => visible.value,
  (newVal) => {
    if (newVal) {
      openStartDialog()
    }
  },
  { immediate: true },
)

// 停止录音
async function stopRecording() {
  try {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
      mediaRecorder.value.stream.getTracks().forEach(track => track.stop())
    }
    await endVoice({ deviceId: deviceId.value, sessionId: sessionId.value })
    message.success('喊话结束')
    isRecording.value = false
    hasError.value = false
    errorMessage.value = ''
    visible.value = false
  }
  catch (error) {
    handleError(error, '结束喊话失败')
  }
}

// 清理资源
function cleanup() {
  try {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
      mediaRecorder.value.stream.getTracks().forEach(track => track.stop())
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.close()
    }
    if (audio.value) {
      audio.value.pause()
      audio.value.src = ''
    }
    isRecording.value = false
    hasError.value = false
    errorMessage.value = ''
  }
  catch (error) {
    console.error('清理资源时出错:', error)
  }
}

// 确保在页面关闭时结束喊话
function ensureEndVoice() {
  if (isRecording.value && deviceId.value && sessionId.value) {
    // 使用同步方式发送请求，确保在页面关闭前完成
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/one-click-alarm/voice/end', false) // 同步请求
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
      if (unref(token)) {
        xhr.setRequestHeader('Authorization', `Bearer ${unref(token)}`)
      }
      xhr.send(JSON.stringify({ deviceId: deviceId.value, sessionId: sessionId.value }))
      console.log('在页面关闭前已发送结束喊话请求')
    }
    catch (error) {
      console.error('页面关闭时结束喊话失败:', error)
    }
  }
}

// 生命周期钩子
onMounted(() => {
  audio.value = document.getElementById('player')
  initializeWebSocket()
  initializeMediaSource()

  // 添加关闭页面时的清理
  window.addEventListener('beforeunload', cleanup)
  // 添加确保结束喊话的处理
  window.addEventListener('beforeunload', ensureEndVoice)
})

onBeforeUnmount(async () => {
  cleanup()
  window.removeEventListener('beforeunload', cleanup)
  // 这种双重保障机制（同步XMLHttpRequest + 异步API调用）能够最大程度地确保在以下情况下都能正确结束喊话：
  window.removeEventListener('beforeunload', ensureEndVoice)

  // 如果仍在录音，确保调用 endVoice
  if (isRecording.value) {
    try {
      await endVoice({ deviceId: deviceId.value, sessionId: sessionId.value })
      console.log('组件卸载时已调用结束喊话接口')
    }
    catch (error) {
      console.error('组件卸载时结束喊话失败:', error)
    }
  }
})
</script>

<template>
  <UmDialog
    v-model:visible="visible"
    title="实时喊话"
    v-bind="$attrs"
    :maskClosable="false"
    :closable="false"
    width="460px"
    height="300px"
    wrapClassName="audioDialog"
    :destroyOnClose="true"
  >
    <div class="flex justify-center items-center flex-col">
      <div class="text-center">
        <img
          src="@/assets/images/systemManage/radioBroadcast/microphone.png"
          alt="麦克风"
          class="w-32 h-32"
        >
        <audio
          id="player"
          autoplay
        />
        <div class="m-t-20px text-lg">
          <template v-if="!hasError">
            {{ isRecording ? '喊话中...' : '准备中...' }}
          </template>
          <template v-else>
            <span class="text-red-500">{{ errorMessage }}</span>
          </template>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-center m-b-10px">
        <AButton
          class="btn"
          type="danger"
          @click="stopRecording"
        >
          结束
        </AButton>
      </div>
    </template>
  </UmDialog>
</template>

<style scoped>
.btn {
  width: 98px;
  border-radius: 4px;
}
</style>
