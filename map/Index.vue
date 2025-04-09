<script setup name="cockpit" lang="jsx">
import { Modal, message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { cloneDeep, debounce } from 'lodash-es'
import WeatherVue from './components/weather'
import { columns, convertGdToBd, emergencyColumns } from './utils'
import { showInfoWindow, calculateIconSize } from './map'
import imgAdmin from '@/assets/images/cockpit/admin.png'
import imgManage from '@/assets/images/cockpit/manage.png'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme.js'
import radio from '@/assets/images/map/radio.png'
import radioOffline from '@/assets/images/map/marker.png'
import topLamp from '@/assets/images/cockpit/top-lamp.png'
import lampIcon from '@/assets/images/cockpit/lamp-icon.png'
import service from '@/api/request'
import { useUmWebsocket } from '@/hooks/useUmWebsocketV2'
import AudioDialog from '@/pages/cockpit/components/realCall/AudioDialog.vue'

const _window = window
const { username, pageTitle, logout, userData, token } = toRefs(useUserStore())
const { setCurrentTheme } = useThemeStore()
setCurrentTheme('dark')

const loginout = () => {
  Modal.confirm({
    content: '您确定要注销吗？',
    onOk() {
      logout.value()
    },
    cancelText: '取消',
    okText: '确定',
    onCancel() {
      Modal.destroyAll()
    },
  })
}

const isGridLevel3User = computed(() => unref(userData).organization?.level === 3)
// 用于切换组件显隐动画
const componentStatus = ref('show')
// 实际控制二级驾驶舱组件的显示
const isShowSecondCockpit = ref(isGridLevel3User.value)
const toggleShowSecondCockpit = (isShow) => {
  componentStatus.value = 'hide'

  setTimeout(() => {
    isShowSecondCockpit.value = isShow
    componentStatus.value = 'show'
  }, 300)
}

const mapInstance = ref(null)
// 存储标记点的Map
const markerMap = new Map()

const pointArray = ref([])
const searchValue = ref('')
const dataSource = ref([])
const emergencyData = ref([])
const isFirstSearch = ref(true)

// 更新标记点图标大小的函数
const updateMarkersSize = () => {
  const currentZoom = mapInstance.value.getZoom()
  const newSize = calculateIconSize(currentZoom)

  // 遍历所有标记点并更新图标大小
  pointArray.value.forEach((point) => {
    const marker = markerMap.get(point.name)
    if (marker) {
      // 计算在线和离线图标的尺寸
      const iconSize = {
        width: newSize,
        height: newSize,
      }

      // 离线图标保持原有宽高比
      const offlineRatio = 26 / 31
      const offlineIconSize = {
        width: Math.round(newSize * offlineRatio),
        height: newSize,
      }

      // 创建新图标并设置到标记点
      const newIcon = new BMapGL.Icon(
        point.status ? radio : radioOffline,
        point.status ? iconSize : offlineIconSize,
      )

      marker.setIcon(newIcon)

      // 更新标签显示状态
      const label = marker.getLabel()
      if (label) {
        if (currentZoom >= 19) {
          label.show()
        }
        else {
          label.hide()
        }
      }
    }
  })
}

// 创建节流版本的更新函数
const throttledUpdateMarkersSize = debounce(updateMarkersSize, 200)

const handleSearch = () => {
  service.post('/lamp-pole/list', {
    name: searchValue.value,
    deviceType: 'lamp-pole',
  }).then((res) => {
    pointArray.value = res

    // 清除地图上所有现有的覆盖物
    mapInstance.value.clearOverlays()
    // 清空标记点Map
    markerMap.clear()

    // 如果是第一次搜索，则设置地图中心点和缩放级别
    if (isFirstSearch.value) {
      if (!pointArray.value || !pointArray.value.length) {
        mapInstance.value.centerAndZoom(new BMapGL.Point(114.334278, 23.04309), 18)
        message.warning('暂无数据！')
        return
      }

      const lng = pointArray.value[Math.floor(pointArray.value.length / 2)].longitude
      const lat = pointArray.value[Math.floor(pointArray.value.length / 2)].latitude

      const [centerLng, centerLat] = convertGdToBd(lng, lat)
      mapInstance.value.centerAndZoom(new BMapGL.Point(centerLng, centerLat), 20)
      isFirstSearch.value = false
    }

    // 获取当前缩放级别的图标尺寸
    const currentZoom = mapInstance.value.getZoom()
    const iconSize = calculateIconSize(currentZoom)

    pointArray.value.forEach((point) => {
      // 转换每个点的坐标
      const [bdLng, bdLat] = convertGdToBd(point.longitude, point.latitude)

      // 计算图标尺寸
      const radioWH = {
        width: iconSize,
        height: iconSize,
      }

      // 离线图标保持原有宽高比
      const offlineRatio = 26 / 31 // 原始宽高比
      const radioOfflineWH = {
        width: Math.round(iconSize * offlineRatio),
        height: iconSize,
      }

      // 创建图标
      const marker = new BMapGL.Marker(new BMapGL.Point(bdLng, bdLat), {
        icon: new BMapGL.Icon(point.status ? radio : radioOffline, point.status ? radioWH : radioOfflineWH),
      })
      mapInstance.value.addOverlay(marker)
      // 将marker存储到Map中
      markerMap.set(point.name, marker)

      // 添加文字描述
      const label = new BMapGL.Label(point.name, {
        position: new BMapGL.Point(bdLng, bdLat),
        offset: new BMapGL.Size(-78, 18), // 水平居中和垂直方向偏移到图标下方
      })
      label.setStyle({
        width: '160px',
        color: '#000',
        fontSize: '14px',
        height: '20px',
        lineHeight: '20px',
        fontFamily: '微软雅黑',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid #fff',
        padding: '0 5px',
        borderRadius: '2px',
        textAlign: 'center',
        whiteSpace: 'nowrap', // 防止文字换行
      })

      // 根据当前缩放级别设置标签的初始显示状态
      if (currentZoom < 19) {
        label.hide()
      }

      mapInstance.value.addOverlay(label)
      marker.setLabel(label)
      marker.addEventListener('click', () => {
        // 创建一个新的点对象，包含转换后的坐标
        const bdPoint = {
          ...point,
          longitude: bdLng,
          latitude: bdLat,
        }
        showInfoWindow(mapInstance.value, bdPoint)
      })
    })
  })
}

const emergencyTableRef = ref(null)
let scrollInterval = null
// 添加表格滚动控制相关状态
const isScrollPaused = ref(false) // 是否暂停滚动
const isReturningToTop = ref(false) // 是否正在返回顶部

// 滚动暂停和恢复相关函数
const pauseScroll = () => {
  isScrollPaused.value = true
}

const resumeScroll = () => {
  isScrollPaused.value = false
}

// 实现无缝滚动的函数
const setupSeamlessScroll = () => {
  // 获取表格主体
  const tableBody = document.querySelector('.emergency-table .ant-table-body')
  if (!tableBody) {
    return
  }

  // 获取表格内容
  const tableContent = tableBody.querySelector('.ant-table-tbody')
  if (!tableContent) {
    return
  }

  // 克隆表格内容
  const clonedContent = tableContent.cloneNode(true)

  // 将克隆的内容添加到原来的内容后面
  tableContent.parentNode.appendChild(clonedContent)

  // 添加鼠标悬停事件监听
  tableBody.addEventListener('mouseenter', pauseScroll)
  tableBody.addEventListener('mouseleave', resumeScroll)
}

// const timer = ref(null)
let statisticsInterval = null
let eventListInterval = null
let searchInterval = null
let monitorInterval = null

// 获取在线设备统计数据
const fetchOnlineStatistics = () => {
  service.post('/lamp-pole/online-statistics-list', {}).then((res) => {
    dataSource.value = res.map(item => ({
      ...item,
      total: `${item.total}台`,
      onlineNum: `${item.onlineNum}台`,
      onlineRate: `${(item.onlineRate * 100).toFixed(2)}%`,
      faultRate: `${item.faultRate}%`,
    }))
  })
}

// 获取实时事件列表(紧急求助报警盒)
const fetchRealEventList = () => {
  service.post('/one-click-alarm/list', {}).then((res) => {
    emergencyData.value = res.map((item, index) => ({
      ...item,
      index: index + 1,
      startDateTime: item.startDateTime ? dayjs(item.startDateTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      operation: '立即处理',
    }))

    // 在数据加载完成后，克隆并添加数据，实现无缝滚动
    setTimeout(() => {
      if (emergencyData.value && emergencyData.value.length > 3) {
        setupSeamlessScroll()
      }
    }, 100)
  })
}

const { register } = useUmWebsocket(['一键报警信息更新'])

register(() => {
  console.log('一键报警信息更新...')
  fetchRealEventList()
})

const monitorColumns = ref([])
const monitorData = ref([])
// 查询环境监测数据
const getEnvironmentalData = () => {
  service.post('/lamp-pole/env-monitor-data').then((res) => {
    if (res.length) {
      const data = res[0].columns.map((item) => {
        return {
          title: item.columnName,
          dataIndex: item.columnCode,
          align: 'center',
          ellipsis: true,
        }
      })
      monitorColumns.value = [{
        title: '设备',
        dataIndex: 'name',
        align: 'center',
        ellipsis: true,
      }, ...data]

      monitorData.value = res.map((item) => {
        return {
          ...item.realData,
          name: item.name,
        }
      })
    }
  })
}

/** 获取地图实例 */
onMounted(() => {
  const map = new BMapGL.Map('map-container')
  mapInstance.value = map
  // map.centerAndZoom(new BMapGL.Point(114.334278, 23.04309), 18)
  map.enableScrollWheelZoom(true)
  map.setMinZoom(18)

  // 监听地图缩放事件，使用节流函数优化性能
  map.addEventListener('zoomend', throttledUpdateMarkersSize)

  // 首次加载数据
  fetchOnlineStatistics()
  fetchRealEventList()
  getEnvironmentalData()
  // 设置定时器，每30秒刷新一次
  statisticsInterval = setInterval(fetchOnlineStatistics, 30000)
  eventListInterval = setInterval(fetchRealEventList, 30000)
  monitorInterval = setInterval(getEnvironmentalData, 30000)

  handleSearch()
  searchInterval = setInterval(handleSearch, 30000)

  // 设置紧急报警表格的自动滚动
  scrollInterval = setInterval(() => {
    if (emergencyData.value.length > 3 && !isScrollPaused.value) {
      const tableBody = document.querySelector('.emergency-table .ant-table-body')
      if (tableBody && !isReturningToTop.value) {
        // 无缝滚动检测：当滚动到原始内容末尾时，重置位置到克隆内容起始处
        const originalDataHeight = tableBody.scrollHeight / 2 // 假设克隆后高度是原来的2倍
        if (tableBody.scrollTop >= originalDataHeight) {
          // 立即重置到上半部分相同位置（无过渡效果）
          tableBody.style.scrollBehavior = 'auto'
          tableBody.scrollTop = tableBody.scrollTop - originalDataHeight
        }
        else {
          // 正常每次滚动1像素
          tableBody.scrollTop += 1
        }
      }
    }
  }, 50)
})

onUnmounted(() => {
  if (scrollInterval) {
    clearInterval(scrollInterval)
  }
  if (statisticsInterval) {
    clearInterval(statisticsInterval)
  }
  if (eventListInterval) {
    clearInterval(eventListInterval)
  }
  if (searchInterval) {
    clearInterval(searchInterval)
  }
  if (monitorInterval) {
    clearInterval(monitorInterval)
  }

  // 清理表格事件监听
  const tableBody = document.querySelector('.emergency-table .ant-table-body')
  if (tableBody) {
    tableBody.removeEventListener('mouseenter', pauseScroll)
    tableBody.removeEventListener('mouseleave', resumeScroll)
  }
})

const handlePointClick = (point) => {
  if (!mapInstance.value) {
    return
  }

  // 转换坐标
  const [bdLng, bdLat] = convertGdToBd(point.longitude, point.latitude)
  // 设置地图中心点和缩放级别
  const targetPoint = new BMapGL.Point(bdLng, bdLat)
  mapInstance.value.setCenter(targetPoint)

  // 延迟显示信息窗口，确保地图定位和缩放完成
  setTimeout(() => {
    // 创建一个新的点对象，包含转换后的坐标
    const bdPoint = {
      ...point,
      longitude: bdLng,
      latitude: bdLat,
    }
    showInfoWindow(mapInstance.value, bdPoint)
  }, 300)
}

const showAudioDialog = ref(false)
const deviceId = ref()

// 点击立即处理
const handleOperation = (row) => {
  if (!row.oneClickAlarmId) {
    message.warning('设备id不存在')
    return
  }
  deviceId.value = Number(row.oneClickAlarmId)
  showAudioDialog.value = true
}
</script>

<template>
  <ALayout class="um-layout flex relative page-container">
    <div
      id="map-container"
      class="map"
      style="width: 100%; height: 100%;"
    />

    <div class="main-title">
      {{ '智慧灯杆运维管理平台' }}
    </div>

    <div class="left-btn absolute left-0 top-3px z-100">
      <AButton
        v-show="isShowSecondCockpit && !isGridLevel3User"
        type="text"
        @click="toggleShowSecondCockpit(false)"
      >
        <img
          class="pr-0.5rem mb-0.25rem"
          src="~/assets/images/safeProduct/icon_home.png"
        >
        <span class="text-16px">返回驾驶舱</span>
      </AButton>
      <WeatherVue class="p-10px" />
    </div>

    <div class="secondary-navs">
      <ADropdown>
        <div>
          <img :src="imgAdmin">
          <span>{{ username }}</span>
        </div>
        <template #overlay>
          <AMenu>
            <AMenuItem key="0">
              <div @click="$router.push('/systemManage')">
                <img
                  :src="imgManage"
                  class="mr"
                >
                <span>后台管理</span>
              </div>
            </AMenuItem>
            <AMenuItem key="1">
              <div
                className="flex items-center"
                @click="loginout"
              >
                <span className="i-carbon:power mr" />
                注销
              </div>
            </AMenuItem>
          </AMenu>
        </template>
      </ADropdown>
    </div>

    <div
      class="right-container"
    >
      <div class="panel">
        <div class="panel-title">
          设备统计
        </div>
        <ATable
          :columns="columns"
          :dataSource="dataSource"
          :pagination="false"
          :scroll="{ y: 200 }"
          bordered
        />
      </div>
      <div class="panel mt-4">
        <div class="panel-title">
          紧急救助报警盒
        </div>
        <ATable
          ref="emergencyTableRef"
          :columns="emergencyColumns"
          :dataSource="emergencyData"
          :pagination="false"
          :scroll="{ y: 160 }"
          bordered
          class="emergency-table"
        >
          <template #bodyCell="{ column, text, record }">
            <template v-if="column.dataIndex === 'operation'">
              <AButton
                type="link"
                class="operation-btn"
                @click="handleOperation(record)"
              >
                {{ text }}
              </AButton>
            </template>
            <template v-else>
              {{ text }}
            </template>
          </template>
        </ATable>
      </div>

      <div class="panel mt-4">
        <div class="panel-title">
          环境监测
        </div>
        <ATable
          :columns="monitorColumns"
          :dataSource="monitorData"
          :pagination="false"
          :scroll="{ y: 100 }"
          bordered
        />
      </div>
    </div>

    <div
      class="left-container"
    >
      <AInputSearch
        v-model:value="searchValue"
        placeholder="请输入关键字"
        allowClear
        class="mb-10px ml-10px search-input"
        @search="handleSearch"
      />
      <div class="device-list">
        <div
          v-for="point in pointArray"
          :key="point.name"
          class="device-item"
          @click="handlePointClick(point)"
        >
          {{ point.name }}
        </div>
      </div>
    </div>

    <AudioDialog
      v-if="showAudioDialog"
      v-model:visible="showAudioDialog"
      :deviceId="deviceId"
    />
  </ALayout>
</template>
<style lang="scss" scoped>
:deep(.map) {
  position: absolute;
  left: 0;
  top: 0;
  // z-index: 100;
}

.text-bold {
  font-weight: bold
}

.page-container {
  width: 100vw;
  height: 100vh;
  // min-width: 1920px;
  // min-height: 969px;
  // background: url('@/assets/images/cockpit/mapBg.png') no-repeat center center;
  background-size: cover;
  color: #fff;
  user-select: none;
}

.main-title {
  padding-top: 6px;
  font-size: 32px;
  width: 100vw;
  box-sizing: border-box;
  height: 75px;
  background: url('@/assets/images/cockpit/top-lamp.png') no-repeat center center;
  background-size: cover;
  text-align: center;
  z-index: 10;
}

.secondary-navs {
  top: 0px;
  right: 13px;
  position: absolute;
  font-size: 16px;
  display: flex;
  z-index: 10;

  div {
    display: flex;
    align-items: center;
    height: 40px;
    margin-left: 30px;
    cursor: pointer;

    img {
      width: 18px;
      height: 18px;
      margin-right: 10px;
    }

  }
}

.left-container,
.right-container {
  // width: 420px;
  height: calc(100vh - 100px);
  position: absolute;
  top: 90px;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  z-index: 10;
  transition: all linear 0.3s;
  background: rgba(0, 28, 51, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 5px;
}

.right-container {
  width: 440px;
  right: 0;
  padding: 10px;
  margin-right: 18px;

  &.hide {
    right: -480px;
  }

  .panel {
    background: rgba(0, 28, 51, 0.6);
    border: 1px solid rgba(0, 228, 255, 0.2);
    border-radius: 8px;
    padding: 15px;

    .panel-title {
      font-size: 18px;
      color: #00e4ff;
      margin-bottom: 15px;
      font-weight: bold;
    }
  }

  .operation-btn {
    color: #00e4ff;
    padding: 0;
    height: auto;

    &:hover {
      color: #40a9ff;
    }
  }
}

.left-container {
  width: 380px;
  left: 0;
  margin-left: 18px;

  &.hide {
    left: -480px;
  }

  .search-input {
    width: 95%;
  }
}

:deep(.ant-table) {
  background: transparent;
  color: #fff;

  .ant-table-thead>tr>th {
    background: rgba(0, 28, 51, 0.8);
    color: #00e4ff;
    border-color: rgba(0, 228, 255, 0.2);
    text-align: center;
    padding: 8px;
  }

  .ant-table-tbody>tr>td {
    background: transparent;
    border-color: rgba(0, 228, 255, 0.2);
    color: #fff;
    padding: 8px;
  }

  .ant-table-tbody>tr:hover>td {
    background: rgba(0, 228, 255, 0.1);
  }
}

:deep(.ant-input-search) {
  .ant-input {
    color: #fff;

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .ant-input-search-button {
    background: rgba(0, 228, 255, 0.2);
    border: 1px solid rgba(0, 228, 255, 0.2);

    .anticon {
      color: #00e4ff;
    }
  }
}

.device-list {
  padding: 0 10px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;

  .device-item {
    padding: 10px;
    margin-bottom: 8px;
    background: rgba(0, 28, 51, 0.6);
    border: 1px solid rgba(0, 228, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    color: #fff;

    &:hover {
      background: rgba(0, 228, 255, 0.1);
      border-color: #00e4ff;
    }
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 228, 255, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 28, 51, 0.6);
    border-radius: 3px;
  }
}

:deep(.ant-table-body) {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 228, 255, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 28, 51, 0.6);
    border-radius: 3px;
  }
}

@media (max-width: 1535.9px) {
  .btn-container {
    height: auto;
    padding: 2px 10px;

    img {
      width: 12px;
    }
  }
}

:deep(.ant-popover-inner) {
  background: transparent;
}

:deep(.ant-popover-inner-content) {
  color: #00e4ff;
  background: url('@/assets/images/cockpit/floatBg.png') no-repeat center center;
  background-size: 100% 100%;
}

:deep(.ant-tree) {
  background: transparent;
  color: #fff;

  .ant-tree-node-content-wrapper {
    color: #fff;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  .ant-tree-node-selected {
    background-color: rgba(255, 255, 255, 0.2) !important;
  }
}

:deep(.ant-table-cell) {
  &::before {
    display: none !important;
  }
}

.emergency-table {
  :deep(.ant-table-body) {
    scroll-behavior: smooth;
  }
}
</style>
<style lang="scss" module="style">
.root {
  :global {
    .ant-btn-primary {
      background-color: var(--ant-primary-color) !important;
    }

    .ant-modal-content {
      background-color: lightblue !important;
    }
  }
}
</style>
<route lang="json">{
  "meta": {
    "name": "驾驶舱",
    "permissions": "dingjiquanxian:tongqiaoweinao:shouyejiashicang"
  }
}</route>
