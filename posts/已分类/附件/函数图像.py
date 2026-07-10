import numpy as np
import matplotlib.pyplot as plt
import os
from matplotlib.font_manager import FontProperties

# Font fallback list to ensure correct Chinese rendering
font_list = [
    'SimHei', 'Noto Sans CJK SC', 'WenQuanYi Micro Hei', 'Droid Sans Fallback',
    'Arial Unicode MS', 'STHeiti', 'Microsoft YaHei'
]

plt.rcParams['axes.unicode_minus'] = False

# Set default font fallback
for f in font_list:
    plt.rcParams['font.sans-serif'] = [f] + plt.rcParams['font.sans-serif']

fig, axes = plt.subplots(2, 3, figsize=(16, 10), dpi=300)
fig.suptitle("常见函数图像及关键点速查手册", fontsize=22, fontweight='bold', color='#2c3e50')

def setup_axes(ax):
    """设置高雅、清晰的十字数学坐标系"""
    ax.spines['top'].set_color('none')
    ax.spines['right'].set_color('none')
    ax.spines['left'].set_position(('data', 0))
    ax.spines['bottom'].set_position(('data', 0))
    ax.spines['left'].set_color('#7f8c8d')
    ax.spines['bottom'].set_color('#7f8c8d')
    ax.spines['left'].set_linewidth(1.2)
    ax.spines['bottom'].set_linewidth(1.2)
    ax.grid(True, linestyle='--', alpha=0.5, color='#bdc3c7')
    ax.tick_params(colors='#34495e', labelsize=10)

def plot_key_point(ax, x0, y0, label, text_offset=(12, 12)):
    """高亮标注关键点并绘制到坐标轴的红色虚线投影"""
    # 绘制高亮红点
    ax.scatter([x0], [y0], color='#e74c3c', s=60, zorder=6, edgecolors='white', linewidths=1)
    
    # 绘制到 x 轴的虚线投影
    if abs(y0) > 1e-5:
        ax.plot([x0, x0], [0, y0], color='#e74c3c', linestyle=':', alpha=0.7, linewidth=1.2, zorder=4)
    # 绘制到 y 轴的虚线投影
    if abs(x0) > 1e-5:
        ax.plot([0, x0], [y0, y0], color='#e74c3c', linestyle=':', alpha=0.7, linewidth=1.2, zorder=4)
        
    # 标注文字（带精致的半透明背景框，防止与图像线条重叠）
    ax.annotate(label, xy=(x0, y0), xytext=text_offset, textcoords="offset points", 
                color='#c0392b', fontsize=11, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.3', fc='#fdf2e9', alpha=0.85, ec='#fadbd8', lw=1),
                zorder=7)

# ================= 1. 对数函数 =================
ax = axes[0, 0]
setup_axes(ax)
x = np.linspace(0.01, 10, 500)
ax.plot(x, np.log(x), label="y = ln(x)", color='#2980b9', linewidth=2)
ax.set_title("对数函数\n[ 定义域: x ∈ (0, +∞) ]", pad=20, fontsize=13, fontweight='bold', color='#2c3e50')
plot_key_point(ax, 1, 0, '$(1, 0)$', text_offset=(12, 12))
ax.legend(loc="lower right", framealpha=0.9)
ax.set_xlim(-1, 6)
ax.set_ylim(-3, 3)

# ================= 2. 幂函数 =================
ax = axes[0, 1]
setup_axes(ax)
x = np.linspace(-2.5, 2.5, 500)
ax.plot(x, x**2, label="y = x²", color='#27ae60', linewidth=2)
ax.plot(x, x, label="y = x", color='#16a085', linewidth=1.5, linestyle='--')

x_pos = np.linspace(0, 2.5, 500)
ax.plot(x_pos, np.sqrt(x_pos), label="y = x^(1/2)", color='#f39c12', linewidth=2)

x_inv = np.linspace(-2.5, 2.5, 500)
x_inv[np.abs(x_inv) < 0.05] = np.nan 
ax.plot(x_inv, x_inv**-1, label="y = x^-1", color='#9b59b6', linewidth=2)

ax.set_title("幂函数\n[ 定义域: 视指数而定 ]", pad=20, fontsize=13, fontweight='bold', color='#2c3e50')
ax.set_ylim(-3, 3)
ax.set_xlim(-2.5, 2.5)
plot_key_point(ax, 1, 1, '$(1, 1)$', text_offset=(12, -20))
ax.legend(loc="lower right", framealpha=0.9)

# ================= 3. 指数函数 =================
ax = axes[0, 2]
setup_axes(ax)
x = np.linspace(-3, 3, 500)
ax.plot(x, 2**x, label="y = 2^x", color='#d35400', linewidth=2)
ax.plot(x, 0.5**x, label="y = (1/2)^x", color='#e67e22', linewidth=2)
ax.set_title("指数函数\n[ 定义域: x ∈ R ]", pad=20, fontsize=13, fontweight='bold', color='#2c3e50')
ax.set_xlim(-3, 3)
ax.set_ylim(-0.5, 5)
plot_key_point(ax, 0, 1, '$(0, 1)$', text_offset=(15, 8))
ax.legend(loc="upper center", framealpha=0.9)

# ================= 4. 三角函数 =================
ax = axes[1, 0]
setup_axes(ax)
x = np.linspace(-2*np.pi, 2*np.pi, 500)
ax.plot(x, np.sin(x), label="y = sin(x)", color='#2980b9', linewidth=2)
ax.plot(x, np.cos(x), label="y = cos(x)", color='#e74c3c', linewidth=1.5, linestyle='-.')
ax.set_title("三角函数\n[ 定义域: x ∈ R ]", pad=20, fontsize=13, fontweight='bold', color='#2c3e50')
ax.set_xlim(-2*np.pi, 2*np.pi)
ax.set_ylim(-1.5, 1.5)

cross_x, cross_y = np.pi/4, np.sqrt(2)/2
plot_key_point(ax, cross_x, cross_y, r'$(\frac{\pi}{4}, \frac{\sqrt{2}}{2})$', text_offset=(15, 12))

ax.set_xticks([-2*np.pi, -np.pi, 0, np.pi, 2*np.pi])
ax.set_xticklabels([r'$-2\pi$', r'$-\pi$', '0', r'$\pi$', r'$2\pi$'])
ax.legend(loc="lower left", framealpha=0.9)

# ================= 5. 反三角函数 =================
ax = axes[1, 1]
setup_axes(ax)

x_limit = np.linspace(-1, 1, 500)
ax.plot(x_limit, np.arcsin(x_limit), label="y = arcsin(x)", color='#8e44ad', linewidth=2)
ax.plot(x_limit, np.arccos(x_limit), label="y = arccos(x)", color='#2c3e50', linewidth=2)

x_inf = np.linspace(-2.5, 2.5, 500)
ax.plot(x_inf, np.arctan(x_inf), label="y = arctan(x)", color='#16a085', linewidth=1.5, linestyle='--')

ax.set_title("反三角函数\n[ arcsin/cos定义域[-1,1], arctan定义域R ]", pad=20, fontsize=13, fontweight='bold', color='#2c3e50')
ax.set_xlim(-2.5, 2.5)
ax.set_ylim(-2, 3.5)

cross_x2 = np.sqrt(2)/2
cross_y2 = np.pi/4
plot_key_point(ax, cross_x2, cross_y2, r'$(\frac{\sqrt{2}}{2},\frac{\pi}{4})$', text_offset=(15, -15))
ax.set_yticks([-np.pi/2, 0, np.pi/2, np.pi])
ax.set_yticklabels([r'$-\frac{\pi}{2}$', '0', r'$\frac{\pi}{2}$', r'$\pi$'])
ax.legend(loc="upper left", framealpha=0.9)

# ================= 6. 处理空白子图 =================
axes[1, 2].axis("off")

plt.tight_layout()
plt.subplots_adjust(top=0.88, hspace=0.45)

# ================= 保存 =================
# Fallback for __file__ if running in Jupyter/Interactive shells
try:
    current_path = os.path.dirname(os.path.abspath(__file__))
except NameError:
    current_path = os.getcwd()

png_path = os.path.join(current_path, "common_mathematical_functions.png")
pdf_path = os.path.join(current_path, "common_mathematical_functions.pdf")

plt.savefig(png_path, bbox_inches='tight', dpi=300)
plt.savefig(pdf_path, bbox_inches='tight', dpi=300)
plt.close()

print("生成完成！")
print("PNG:", png_path)
print("PDF:", pdf_path)