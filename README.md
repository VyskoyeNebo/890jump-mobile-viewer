# 890 Jump 原厂配色 · 手机 3D 查看器

**当前是测试版**。早期单贴图烘焙方案出现了玻璃和材质错误，已替换为独立分层材质。替换后的基础显示已经检查；最后一次金属反射与材质混合参数修正后，浏览器检查工具断连，尚未完成最终视觉复核。Android 9–12 也尚未逐版本真机实测。

Android APK + 独立网页版。使用游戏文件来源的 890 Jump 外壳、原始 UV、原厂调色板与分层材质数据，支持离线旋转、缩放、平移和六个预设视角。

- **APK 下载**：仓库右侧 Releases，下载 `890Jump-Android9-12-v1.0.0-beta.1.apk`。
- **网页预览**：https://vyskoyenebo.github.io/890jump-mobile-viewer/
- 单指旋转；双指缩放、平移；双击复位；可切换船底、船尾视角、亮度和背景。
- Android 最低版本 **9 / API 28**，面向 Android 9、10、11、12；需要设备 WebView 支持 WebGL / OpenGL ES 2.0。
- APK 自带模型、贴图和 JavaScript，无广告、无账号、无联网权限。

## 原厂配色的来源

当前查看器资源取自 [The Impound 的游戏文件 3D 查看器原厂版本](https://theimpound.com/pages/paint-viewer?ship=890-jump&paint=stock)：几何、原始 UV、原厂调色板、材质分层与表面属性均保留为独立数据。材质解释与手机端渲染代码由本项目实现，未包含第三方网站的渲染器源代码。

材质采用 Three.js 的移动端 PBR 实现，保留玻璃透明度、法线/光泽度通道和材质贴花；纹理压缩至适合手机的尺寸。网页光照、反射与游戏引擎仍存在差别，不能将本软件称为游戏着色器的逐像素复刻。金牛座打印模型由本机 `Data.p4k` 独立提取和实体化。

`web/assets/model-info.json` 记录导出面数、贴图尺寸和模型大小。原始 P4K 档案、登录信息和 APK 私钥不在仓库中。

## 本地运行

安装 Node.js、Python 后：

```powershell
npm ci
npm run build
npm run serve
```

访问 `http://127.0.0.1:8765/`。`web/` 可直接部署到静态网站，不依赖外部 CDN。

## 构建 APK

需要 JDK 17+、Android SDK platform 35、build-tools 35.0.0。首次构建会生成本机私有签名密钥，保存在已被 Git 忽略的 `.signing/`；保留它才能签署后续升级版本。

```powershell
./build-android.ps1 -JavaHome 'C:/Program Files/Java/jdk-17' -SdkPath 'E:/APkMCJAVA/.android-sdk'
```

输出 `dist/890Jump-Android9-12-v1.0.0-beta.1.apk`。不要上传 `.signing/` 或 `local.properties`。

## 检查范围

- Android Release 编译、Android Lint、APK 签名和 APK 内置资源完整性检查。
- 浏览器竖屏/横屏布局、模型载入、视角切换、旋转与缩放检查。
- 当前没有连接 Android 真机；Android 9–12 的兼容范围依据最低 SDK、使用的系统 API 和 WebGL 1 渲染路径，尚未逐版本真机实测。

## 金牛座 300 mm 打印文件

同一 Release 提供 `Taurus-300mm-print-files.zip`。内容包括完整模型、船首/船尾两段 STL、两个板位的 3MF、直径 4 mm 的定位销和验证报告。两段各长 150 mm，切面朝下，可放进 A1 的打印范围。拼合后整船长 300.00 mm。

## 版权与许可

本项目是非官方爱好者工具。舰船、名称、商标及原始美术资源属于 Cloud Imperium Games / Roberts Space Industries。项目代码采用 MIT 许可；**该代码许可不覆盖提取或烘焙后的游戏模型与贴图**。Three.js 的 MIT 许可见 `THIRD_PARTY_NOTICES.txt`。
