import service from '@/api/request'
/** 创建并显示信息窗口 */
export const showInfoWindow = (map, point) => {
  // 移除之前的信息窗口（如果存在）
  const allOverlays = map.getOverlays() // 获取当前地图上的所有覆盖物，返回覆盖物对象的集合 Array<Overlay>
  allOverlays.forEach((overlay) => {
    if (overlay._customInfo) {
      // 从地图中移除覆盖物。如果覆盖物从未被添加到地图中，则该移除不起任何作用
      map.removeOverlay(overlay)
    }
  })

  // 创建自定义覆盖物
  class CustomInfoBox extends BMapGL.Overlay {
    constructor(point, content) {
      super() // 调用父类的构造函数
      this._point = point // 保存传入的地理坐标点
      this._content = content // 保存传入的 HTML 内容
      this._customInfo = true // 标记为自定义信息窗口
    }

    initialize(map) {
      this._map = map // 保存地图实例
      const div = document.createElement('div') // 创建一个 HTML 容器
      div.style.position = 'absolute' // 设置样式
      div.innerHTML = this._content // 设置内容
      map.getPanes().labelPane.appendChild(div) // 将容器添加到地图的 `labelPane`
      this._div = div

      // 添加点击事件监听
      this._div.addEventListener('click', (e) => {
        e.stopPropagation() // 阻止事件冒泡
      })

      // 添加关闭按钮的点击事件
      const closeBtn = this._div.querySelector('.close-btn')
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          map.removeOverlay(this)
        })
      }

      return div // 返回创建的 DOM 元素
    }

    draw() {
      const position = this._map.pointToOverlayPixel(this._point) // 将地理坐标转换为像素坐标
      this._div.style.left = `${position.x - 150}px` // 250/2，使其居中（设置水平位置）
      // 获取实际内容高度并添加一个固定的间距值（10px）
      const height = this._div.offsetHeight
      this._div.style.top = `${position.y - height - 20}px` // 使用动态高度进行定位（设置垂直位置）
    }
  }

  // 先获取子设备信息，然后创建信息窗口
  service.post('/lamp-pole/list', {
    parentId: point.deviceId,
  }).then((childrenDevice) => {
    console.log('childrenDevice', childrenDevice)
    // 构建子设备信息HTML
    let childrenDeviceHtml = ''
    if (childrenDevice && childrenDevice.length > 0) {
      childrenDeviceHtml = `
        <div style="margin-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 10px;">
          <div style="margin-bottom: 10px; font-weight: bold; color: #00e4ff;">子设备列表：</div>
      `
      childrenDevice.forEach((device) => {
        if (device.deviceType === 'lamp-controller') {
          childrenDeviceHtml += `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <span style="min-width: 80px; max-width: 218px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${device.name}">${device.name}</span>
            </div>
          `
        }
        else {
          childrenDeviceHtml += `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <span style="min-width: 80px; max-width: 218px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${device.name}">${device.name}</span>
              <span style="margin-left: auto; color: ${device.status ? '#52c41a' : '#f5222d'}">${device.status ? '在线' : '离线'}</span>
            </div>
          `
        }
      })
      childrenDeviceHtml += '</div>'
    }

    // 自定义信息窗口的内容
    const content = `
      <div class="custom-info-box" style="
        width: 300px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        color: #fff;
        font-family: 微软雅黑;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          right: 10px;
          top: 10px;
          cursor: pointer;
          z-index: 1;
        " class="close-btn">
          <span style="
            color: rgba(255, 255, 255, 0.7);
            font-size: 18px;
          ">×</span>
        </div>
        <div style="
          font-size: 16px;
          font-weight: bold;
          padding: 8px 15px;
          background: rgba(0, 228, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        ">${point.name}</div>
        <div style="padding: 15px;">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="min-width: 80px; color: rgba(255, 255, 255, 0.7);">设备名称：</span>
            <span>${point.name}</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="min-width: 80px; color: rgba(255, 255, 255, 0.7);">设备类型：</span>
            <span>智慧灯杆</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="min-width: 80px; color: rgba(255, 255, 255, 0.7);">在线状态：</span>
            <span style="color: ${point.status ? '#52c41a' : '#f5222d'}">${point.status ? '在线' : '离线'}</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="min-width: 80px; color: rgba(255, 255, 255, 0.7);">经度：</span>
            <span>${point.longitude}</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: ${childrenDevice && childrenDevice.length > 0 ? '10px' : '0'};">
            <span style="min-width: 80px; color: rgba(255, 255, 255, 0.7);">纬度：</span>
            <span>${point.latitude}</span>
          </div>
          ${childrenDeviceHtml}
        </div>
      </div>
    `

    // 创建并添加自定义覆盖物
    const customOverlay = new CustomInfoBox(
      new BMapGL.Point(point.longitude, point.latitude), // 地理坐标点
      content, // 自定义 HTML 内容
    )
    // 将覆盖物添加到地图中，一个覆盖物实例只能向地图中添加一次
    map.addOverlay(customOverlay)
  })
}

const minSize = 16 // 最小图标尺寸
const maxSize = 32 // 最大图标尺寸

// 计算图标尺寸的函数
export const calculateIconSize = (currentZoom) => {
  // 修正逻辑：缩放级别在15-20之间变化
  if (currentZoom <= 18) {
    return minSize // 最小尺寸 16px
  }
  else if (currentZoom >= 20) {
    return maxSize // 最大尺寸 32px
  }
  else {
    // 线性插值计算中间尺寸
    return Math.round(minSize + (currentZoom - 18) * (maxSize - minSize) / (20 - 18))
  }
}