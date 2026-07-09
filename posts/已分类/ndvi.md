---
title: "GEE 如何计算 NDVI？"
date: "2026-07-04"
category: "遥感"
tags:
  - GEE
  - 遥感
  - NDVI
  - JavaScript
  - 植被指数
---

## 什么是 NDVI？

NDVI（Normalized Difference Vegetation Index，归一化差异植被指数）是遥感领域最经典、使用最广泛的植被指数，没有之一。它的公式非常简单：

$$
NDVI = \frac{NIR - RED}{NIR + RED}
$$

其中：

- **NIR**：近红外波段的反射率，健康植被在此波段有强反射。
- **RED**：红光波段的反射率，植被中的叶绿素会吸收红光。

NDVI 的取值范围在 -1 到 1 之间。一般来说，0 以下代表水体、云或裸岩；0.1~0.2 代表裸土；0.3~0.5 代表稀疏植被；0.6~0.9 代表茂密植被。

## GEE 的基本概念

Google Earth Engine（GEE）是一个在线的遥感大数据处理平台，提供了 PB 级别的卫星影像数据和强大的分布式计算能力。在 GEE 中，核心数据模型是 `ee.Image`（影像）和 `ee.ImageCollection`（影像集合）。所有操作都是"懒执行"的——你写的是计算图的描述，真正计算发生在导出或显示的时候。

GEE 的代码编辑器使用 JavaScript API，语法简洁直观。

## 在 GEE 中计算 NDVI

以 Landsat 8 为例，它的波段设置如下：Band 5 是近红外（NIR），Band 4 是红光（RED）。以下是一段完整的 GEE JavaScript 代码，用于计算某地区某时间范围内的 NDVI：

```javascript
// 定义研究区域（以北京为例）
var roi = ee.Geometry.Point([116.4074, 39.9042]).buffer(10000);

// 筛选 Landsat 8 Collection 2 Tier 1 影像
var dataset = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(roi)
    .filterDate('2025-06-01', '2025-09-30')
    .filter(ee.Filter.lt('CLOUD_COVER', 10))
    .median();  // 取中值以减少云的影响

// Landsat 8 SR 数据的波段缩放因子
// NIR = Band 5, RED = Band 4
var nir = dataset.select('SR_B5').multiply(0.0000275).add(-0.2);
var red = dataset.select('SR_B4').multiply(0.0000275).add(-0.2);

// 计算 NDVI
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

// 可视化参数
var ndviVis = {
  min: -1,
  max: 1,
  palette: ['blue', 'white', 'green']
};

// 添加到地图
Map.centerObject(roi, 10);
Map.addLayer(ndvi, ndviVis, 'NDVI');
```

## 关键步骤解析

### 1. 数据筛选与预处理

```javascript
var dataset = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(roi)           // 空间筛选
    .filterDate('start', 'end')  // 时间筛选
    .filter(ee.Filter.lt('CLOUD_COVER', 10))  // 云量筛选
    .median();                    // 中值合成
```

使用 `median()` 进行中值合成是 GEE 中非常常见的去云策略。对于每个像素位置，取多景影像该位置的中值作为最终值，可以有效消除短暂云覆盖的影响。

### 2. 波段缩放

Landsat 8 Collection 2 的 Surface Reflectance 产品存储的是 16-bit 整型值，需要用官方提供的缩放因子转换为真实反射率：

```
反射率 = DN × 0.0000275 + (-0.2)
```

这一步非常重要——如果不做缩放，NDVI 的计算结果会完全错误。

### 3. 波段运算

```javascript
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
```

GEE 中的影像运算遵循"像素到像素"（pixel-wise）的原则，`subtract`、`add`、`divide` 都是逐像素进行的。`.rename('NDVI')` 给输出波段取一个有意义的名字，方便后续操作。

## 批量计算多个植被指数

有了 NDVI 的基础，你可以轻松扩展到其他指数：

```javascript
// EVI（增强植被指数）
var evi = dataset.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
  {
    'NIR': nir,
    'RED': red,
    'BLUE': dataset.select('SR_B2').multiply(0.0000275).add(-0.2)
  }
).rename('EVI');

// NDWI（归一化差异水指数）
var ndwi = nir.subtract(
  dataset.select('SR_B3').multiply(0.0000275).add(-0.2)
).divide(
  nir.add(dataset.select('SR_B3').multiply(0.0000275).add(-0.2))
).rename('NDWI');
```

## 导出结果

```javascript
Export.image.toDrive({
  image: ndvi,
  description: 'Beijing_NDVI_2025',
  scale: 30,
  region: roi,
  maxPixels: 1e13
});
```

导出到 Google Drive 后，你可以在本地 GIS 软件中进一步分析。注意 `scale` 参数——Landsat 8 的原生分辨率是 30 米，保持这个值即可。

## 常见问题

**Q：为什么我算出来的 NDVI 值都是 NaN？**

A：大概率是缩放因子的问题。检查你是否对 Collection 2 数据应用了正确的缩放公式。如果使用 Collection 1 数据，缩放因子是不同的。

**Q：GEE 提示 "Computation timed out" 怎么办？**

A：研究区域太大或时间范围太宽。尝试缩小区域、减少时间跨度，或者在导出时降低分辨率（增大 scale 值）。

## 总结

GEE 让 NDVI 计算变得异常简单——从数据获取到结果可视化，可能只需要 20 行代码。但背后的遥感原理（大气校正、云掩膜、波段特性）仍然需要扎实的基础。建议新手先从 Landsat 8 / Sentinel-2 的单景影像入手，理解了 NDVI 的物理意义之后，再扩展到时间序列分析和更复杂指数。
