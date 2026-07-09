---
title: "ArcGIS 中 shp、gdb、栅格有什么区别？"
date: "2026-07-06"
category: "GIS开发"
tags:
  - ArcGIS
  - GIS
  - 数据格式
  - shapefile
---

## 前言

在 ArcGIS 生态中，空间数据的存储格式选择直接影响项目的效率、可维护性和协作体验。新手最常遇到的困惑就是：shp、gdb（地理数据库）和栅格数据到底有什么区别？什么时候该用哪一种？这篇文章从底层结构到实际应用，把这三类数据讲清楚。

## Shapefile（.shp）：经典但有限

Shapefile 是 ESRI 在 1990 年代推出的矢量数据格式，至今仍是最广泛使用的 GIS 数据交换格式之一。需要注意的是，Shapefile 并不是一个单一文件，而是一组文件的集合，其中必不可少的有三个：

| 文件扩展名 | 作用 |
|-----------|------|
| `.shp` | 存储几何图形的主文件 |
| `.shx` | 几何索引文件，加速空间查询 |
| `.dbf` | 属性表，以 dBase 格式存储 |

除此之外还可能有 `.prj`（坐标系定义）、`.sbn/.sbx`（空间索引）、`.xml`（元数据）等辅助文件。

Shapefile 有几个众所周知的限制：单个文件最大 2GB；字段名最多 10 个字符；不支持拓扑关系；不能存储 NULL 值（只能用空字符串代替）；一个文件只能存一种几何类型（点、线、面不能混存）。

尽管有这些局限，Shapefile 因其"谁都认识"的兼容性，在数据交付和跨平台交换中仍然活跃。几乎所有 GIS 软件都支持直接读写 Shapefile。

## 地理数据库（Geodatabase，.gdb）：现代化的选择

地理数据库是 ESRI 推出的新一代数据存储模型，主要分为三类：

- **File Geodatabase（.gdb）**：以文件夹形式存储在磁盘上，是推荐使用的主流格式。
- **Personal Geodatabase（.mdb）**：基于 Microsoft Access，已逐渐被淘汰。
- **Enterprise Geodatabase**：基于关系型数据库（Oracle、PostgreSQL、SQL Server 等），用于企业级应用。

File Geodatabase 的优势非常明显：

1. **无文件大小限制**：单个要素类可达 TB 级别。
2. **完整的数据模型**：支持拓扑、网络数据集、关系类、属性域（Domain）、子类型（Subtype）等高级特性。
3. **一个文件夹，一套数据**：不像 Shapefile 那样散落一堆文件，gdb 对外就是一个文件夹，便于管理。
4. **性能更好**：空间索引更高效，读写速度显著快于 Shapefile。

```python
# 使用 ArcPy 操作 File Geodatabase
import arcpy

# 设置工作空间
arcpy.env.workspace = r"C:\data\myProject.gdb"

# 列出所有的要素类
feature_classes = arcpy.ListFeatureClasses()
for fc in feature_classes:
    print(fc)
```

如果你在做正式的 GIS 项目，File Geodatabase 几乎是默认选择。只有在需要把数据发给不用 ArcGIS 的同事时，才考虑导出为 Shapefile。

## 栅格数据：另一种世界观

矢量数据用"点—线—面"来抽象世界，而栅格数据用**规则网格的像素矩阵**来描述地表信息。常见的栅格数据包括：

- **遥感影像**：Landsat、Sentinel、MODIS 等卫星数据。
- **数字高程模型（DEM）**：每个像素值代表该位置的高程。
- **土地覆盖分类**：每个像素值代表一种地表类型。
- **气象栅格**：降水量、温度等连续场数据。

在 ArcGIS 中，栅格数据常见的存储格式有：

| 格式 | 说明 |
|------|------|
| TIFF / GeoTIFF | 最通用的栅格格式，可嵌入地理参考信息 |
| ESRI Grid | ArcGIS 的传统栅格格式 |
| IMG（ERDAS Imagine） | 常用于遥感处理 |
| NetCDF / HDF | 科学数据常用格式 |

栅格数据的关键参数包括分辨率（像素大小）、波段数（单波段或多波段）、像元深度（8-bit、16-bit、32-bit 浮点等）和坐标系。

## 如何选择？

简单记住几条原则：

- **矢量→点线面**：选 File Geodatabase；需要对外交换时导出 Shapefile。
- **卫星影像→像素矩阵**：选 GeoTIFF 或 IMG 格式。
- **数据量巨大→TB 级**：矢量用 Enterprise Geodatabase，栅格用镶嵌数据集（Mosaic Dataset）。
- **纯分析、不发布**：什么格式快用什么，gdb 和 tif 是最优先选项。

## 总结

Shapefile 是"够用就好"的交换格式，File Geodatabase 是"专业项目"的工作格式，栅格数据则是"另一套方法论"的空间数据载体。理解它们各自的定位，是 GIS 开发者的基本功。实践中，大多数项目会同时使用这三种格式：用 gdb 管理矢量和分析结果，用 GeoTIFF 存储影像和 DEM，用 Shapefile 做最终交付。
