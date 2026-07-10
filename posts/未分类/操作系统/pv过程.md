---
title: "pv过程"
date: "2026-07-10"

tags:
  - 未分类
---

> ---

# 五大经典问题 PV操作代码

---

## 1. 生产者-消费者问题

**信号量设置：**

```
semaphore mutex = 1    // 互斥访问缓冲区
semaphore empty = n    // 空闲缓冲区数量（初值=缓冲区大小n）
semaphore full  = 0    // 产品数量
```

**代码：**

```
生产者进程：                    消费者进程：
while(true){                   while(true){
    生产一个产品                    P(full)
    P(empty)                        P(mutex)
    P(mutex)                        从缓冲区取产品
    把产品放入缓冲区                V(mutex)
    V(mutex)                        V(empty)
    V(full)                         使用产品
}                              }
```

> ⚠️ **P(mutex) 必须在 P(empty)/P(full) 之后！** 若先P(mutex)再P(empty)，缓冲区满时生产者拿着mutex睡眠，消费者永远拿不到mutex → **死锁**

---

## 2. 多生产者-多消费者问题

**场景：** 父放苹果/橘子，儿取苹果，女取橘子，盘子容量=1

**信号量设置：**

```
semaphore plate  = 1   // 盘子空位（初值=1，只能放一个）
semaphore apple  = 0   // 盘中苹果数
semaphore orange = 0   // 盘中橘子数
```

**代码：**

```
父亲放苹果：          父亲放橘子：          儿子取苹果：          女儿取橘子：
while(true){          while(true){          while(true){          while(true){
    P(plate)              P(plate)              P(apple)              P(orange)
    放苹果                放橘子                取苹果                取橘子
    V(apple)              V(orange)             V(plate)              V(plate)
}                     }                     }                     }
```

> ✅ **缓冲区大小为1时不需要mutex！** 因为 plate=1 本身保证了互斥，同时只有一个进程能放东西进去

---

## 3. 吸烟者问题

**场景：** 供应者随机提供两种材料，三个吸烟者各缺一种材料

```
材料组合：烟草+纸  → 唤醒吸烟者1（有火柴）
         烟草+火柴 → 唤醒吸烟者2（有纸）
         纸+火柴  → 唤醒吸烟者3（有烟草）
```

**信号量设置：**

```
semaphore offer1 = 0   // 唤醒吸烟者1
semaphore offer2 = 0   // 唤醒吸烟者2
semaphore offer3 = 0   // 唤醒吸烟者3
semaphore finish = 0   // 吸烟完毕通知供应者
int i = 0              // 供应者轮转变量
```

**代码：**

```
供应者：                        吸烟者1：             吸烟者2：             吸烟者3：
while(true){                   while(true){          while(true){          while(true){
    if(i == 0){                    P(offer1)             P(offer2)             P(offer3)
        放烟草+纸                  抽烟                  抽烟                  抽烟
        V(offer1)                  V(finish)             V(finish)             V(finish)
    }else if(i == 1){          }                     }                     }
        放烟草+火柴
        V(offer2)
    }else{
        放纸+火柴
        V(offer3)
    }
    P(finish)
    i = (i+1) % 3
}
```

---

## 4. 读者-写者问题

**信号量设置：**

```
semaphore rw    = 1    // 保证读写/写写互斥
semaphore mutex = 1    // 保护count变量
int count = 0          // 当前读者数量
```

**代码：**

```
读者进程：                          写者进程：
while(true){                       while(true){
    P(mutex)                           P(rw)
    count++                            写文件
    if(count == 1)                     V(rw)
        P(rw)      // 第一个读者加锁   }
    V(mutex)
    
    读文件
    
    P(mutex)
    count--
    if(count == 0)
        V(rw)      // 最后一个读者解锁
    V(mutex)
}
```

> ⚠️ **存在写者饥饿问题！** 读者源源不断时，count永远不为0，写者永远拿不到rw

**写者优先改进（加一个w信号量）：**

```
semaphore w = 1        // 新增，防止读者插队

读者：P(w) → P(mutex) → count++ → if(1)P(rw) → V(mutex) → V(w) → 读 → ...
写者：P(w) → P(rw) → 写 → V(rw) → V(w)
```

> 写者来了先P(w)，后续读者P(w)被阻塞，无法插队

---

## 5. 哲学家进餐问题

**信号量设置：**

```
semaphore chopstick[5] = {1,1,1,1,1}  // 5支筷子
semaphore mutex = 1                    // 方法二需要
```

### 方法一：限制同时进餐人数（最多4人拿筷子）

```
semaphore count = 4    // 最多允许4人同时尝试

哲学家i：
while(true){
    思考
    P(count)
    P(chopstick[i])
    P(chopstick[(i+1)%5])
    吃饭
    V(chopstick[i])
    V(chopstick[(i+1)%5])
    V(count)
}
```

### 方法二：同时拿两只筷子（原子操作）

```
哲学家i：
while(true){
    思考
    P(mutex)
    P(chopstick[i])
    P(chopstick[(i+1)%5])
    V(mutex)
    吃饭
    V(chopstick[i])
    V(chopstick[(i+1)%5])
}
```

### 方法三：奇偶规则

```
奇数号哲学家：              偶数号哲学家：
P(chopstick[i])            P(chopstick[(i+1)%5])
P(chopstick[(i+1)%5])      P(chopstick[i])
吃饭                        吃饭
V(chopstick[i])            V(chopstick[(i+1)%5])
V(chopstick[(i+1)%5])      V(chopstick[i])
```

> 打破了"所有人都先拿左边"的环路，避免死锁

---

## 总结对比

|问题|互斥信号量|同步信号量|特殊注意|
|---|---|---|---|
|生产者-消费者|mutex=1|empty/full|P顺序不能错|
|多生产者消费者|不需要|plate/apple/orange|缓冲区=1免mutex|
|吸烟者|不需要|offer1/2/3+finish|供应者轮转|
|读者-写者|rw=1|无|写者可能饥饿|
|哲学家|chopstick|无|三种方案避免死锁|