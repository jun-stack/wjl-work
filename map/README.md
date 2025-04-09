# map

## 自定义类 `CustomInfoBox`
`new CustomInfoBox` 是一个自定义的类实例化。这个类 `CustomInfoBox` 是在代码中定义的一个继承自 `BMapGL.Overlay` 的自定义覆盖物类，用于在地图上显示自定义的信息窗口。

以下是关键点的解释：

在代码中，`CustomInfoBox` 是通过以下方式定义的：
```javascript
class CustomInfoBox extends BMapGL.Overlay {
  constructor(point, content) {
    super(); // 调用父类的构造函数
    this._point = point; // 保存传入的地理坐标点
    this._content = content; // 保存传入的 HTML 内容
    this._customInfo = true; // 标记为自定义信息窗口
  }

  initialize(map) {
    this._map = map; // 保存地图实例
    const div = document.createElement('div'); // 创建一个 HTML 容器
    div.style.position = 'absolute'; // 设置样式
    div.innerHTML = this._content; // 设置内容
    map.getPanes().labelPane.appendChild(div); // 将容器添加到地图的 `labelPane`
    this._div = div;

    // 添加关闭按钮的点击事件
    const closeBtn = this._div.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        map.removeOverlay(this); // 点击关闭按钮时移除覆盖物
      });
    }

    return div; // 返回创建的 DOM 元素
  }

  draw() {
    const position = this._map.pointToOverlayPixel(this._point); // 将地理坐标转换为像素坐标
    this._div.style.left = `${position.x - 150}px`; // 设置水平位置
    const height = this._div.offsetHeight; // 获取内容高度
    this._div.style.top = `${position.y - height - 20}px`; // 设置垂直位置
  }
}
```

### 作用
1. **继承 `BMapGL.Overlay`**：
   - `CustomInfoBox` 继承了百度地图的 `Overlay` 类，允许你创建自定义的地图覆盖物。
   - 通过重写 `initialize` 和 `draw` 方法，定义了覆盖物的初始化逻辑和绘制逻辑。

2. **构造函数**：
   - 接收两个参数：`point`（地理坐标点）和 `content`（HTML 内容）。
   - 将这些参数存储为实例属性，供后续使用。

3. **`initialize` 方法**：
   - 在地图上初始化覆盖物，创建一个 `div` 元素作为覆盖物的容器，并将其添加到地图的 `labelPane` 中。

4. **`draw` 方法**：
   - 根据地图的当前状态（如缩放级别和中心点），计算覆盖物的位置，并更新 `div` 的样式以正确显示。

### 使用
在代码中，`CustomInfoBox` 被实例化并添加到地图中：
```javascript
const customOverlay = new CustomInfoBox(
  new BMapGL.Point(point.longitude, point.latitude), // 地理坐标点
  content // 自定义 HTML 内容
);
map.addOverlay(customOverlay); // 将覆盖物添加到地图
```

### 总结
`CustomInfoBox` 是一个自定义的覆盖物类，用于在百度地图上显示自定义的信息窗口。通过继承 `BMapGL.Overlay` 并重写相关方法，你可以完全控制覆盖物的外观和行为。