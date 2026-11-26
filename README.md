# Logo Studio

基于 Web 的 SVG Logo 设计工具，在浏览器中完成矢量标志的创建与导出。

## 功能

- 矢量编辑：矩形、椭圆、钢笔路径、文本
- 10 款内置开源字体（Poppins, Barlow, Anton, Archivo Black 等）
- 画板裁剪：矩形、圆角、椭圆三种形状
- 图层管理：排序、显隐、锁定、复制、删除
- 属性面板：位置、旋转、缩放、填充、描边、透明度
- 撤销/重做（80 步历史）
- 导出 SVG / PNG（可缩放），支持复制 SVG 到剪贴板
- 屏幕渲染与导出字体一致

## 快速开始

```bash
npm install
npm run dev      # 开发
npm run build    # 构建
npm run preview  # 预览
```

## 技术栈

React 18 / TypeScript / Vite / Zustand / Immer / opentype.js

## 项目结构

```
src/
  components/   Canvas, Toolbar, LayersPanel, PropertiesPanel, TopBar
  model/        types, store, svg, export, outline, fonts, matrix
  App.tsx
  main.tsx
  styles.css
```

## 许可证

MIT
