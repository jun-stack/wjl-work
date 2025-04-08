# audio 双向通话原理

## new MediaRecorder(stream, options)
MediaRecorder 是 Web API 中用于录制媒体流（如音频或视频）的接口。通过 MediaRecorder，可以从媒体流中捕获数据并保存为文件或发送到服务器。

### 参数说明：
1. stream：要录制的媒体流。这是一个 MediaStream 对象，通常通过 navigator.mediaDevices.getUserMedia() 获取。它代表音频或视频的实时流。

2. options:一个可选的配置对象，用于指定录制的媒体格式和编码参数。
    * mimeType: 指定录制的媒体类型和编码格式。例如：
      * audio/webm; codecs=opus：录制 WebM 格式的音频，使用 Opus 编解码器。
      * video/webm; codecs=vp8：录制 WebM 格式的视频，使用 VP8 编解码器。
    * audioBitsPerSecond: 指定音频的比特率（单位：bps）。值越高，音质越好，但文件体积也会更大。

### ondataavailable 事件
ondataavailable 是 MediaRecorder 的一个事件处理器，用于处理录制过程中生成的媒体数据块。当 MediaRecorder 收集到一段媒体数据时，会触发该事件。

1. 工作原理
    * 当调用 mediaRecorder.start(timeslice) 时，MediaRecorder 会以指定的时间间隔（timeslice，单位为毫秒）生成媒体数据块。
    * 每次生成的数据块会通过 ondataavailable 事件传递给开发者。
2. 在这里的代码中，ondataavailable 的作用是将录制的音频数据块转换为 ArrayBuffer，然后通过 WebSocket 发送到服务器。

## new MediaSource()
MediaSource 是 Web API 中的一个接口，用于动态生成媒体流（如音频或视频），并将其传递给 HTML 的 <audio> 或 <video> 元素进行播放。它允许开发者通过 JavaScript 动态地向媒体流中添加数据。
1. 使用场景
在这里的代码中，实现了实时流媒体播放：webSocket 接收音频/视频数据并实时播放。
2. 基本用法
创建 MediaSource 实例
将 MediaSource 对象绑定到 <audio> 或 <video> 元素的 src 属性：
```js
const audioElement = document.createElement('audio');
const mediaSource = new MediaSource();
audioElement.src = URL.createObjectURL(mediaSource);
```
URL.createObjectURL(mediaSource)：为 MediaSource 创建一个临时的 URL，供媒体元素使用。

3. 监听 sourceopen 事件
MediaSource 会在准备好接收数据时触发 sourceopen 事件：
```js
mediaSource.addEventListener('sourceopen', () => {
  console.log('MediaSource is ready');
});
```

4. addSourceBuffer()
* SourceBuffer 是 MediaSource 的核心组件，用于向媒体流中添加数据：
    * addSourceBuffer(mimeType)：指定媒体的 MIME 类型（如 audio/webm; codecs=opus）。
    * sourceBuffer 是一个缓冲区，开发者可以向其中添加媒体数据
```js
mediaSource.addEventListener('sourceopen', () => {
  const sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs=opus');
  console.log('SourceBuffer added');
});
```
* 通过 appendBuffer() 方法向 SourceBuffer 添加媒体数据：
```js
// audioData 是一个 ArrayBuffer 或 Uint8Array，包含音频数据。
sourceBuffer.appendBuffer(audioData);
```
* 缓冲区管理：如果缓冲区满了（如 QuotaExceededError），需要清理旧数据
```js
const buffered = sourceBuffer.buffered;
if (buffered.length > 0) {
  sourceBuffer.remove(0, buffered.end(0) - 3); // 保留最后 3 秒的数据
}
```
