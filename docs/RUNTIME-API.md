# 运行时参数 API

生成代码里除了初始化（`epwm_config.*`），还有一组运行时接口（`epwm_api.*`）。
它的目的很简单：**让下游代码只面对频率 / 占空比 / 相位三个物理量，不再碰寄存器换算。**

---

## 1. 为什么需要这一层

三个物理量之间是**耦合**的，改一个必须连带重算另外两个：

| 你改了 | 如果不连带处理会怎样 |
| --- | --- |
| 频率（TBPRD） | 旧的 `CMPA` 对应到新的占空比 —— 50% 会变成 75% |
| 频率（TBPRD） | `TBPHS` 的物理角度变了 —— 120° 会变成别的角度 |
| 占空比 | `CMPA` 超出 `[1, TBPRD-1]` 时输出恒定，死区后直接没有脉宽 |
| 相位 | 超过 180° 必须同时翻转 `PHSDIR`，否则角度会镜像 |

这些换算由 API 统一维护，你不需要在控制代码里重复推导。

---

## 2. 接口

```c
#include "epwm_api.h"

EPWM_setFrequency(1, 50.0f);   // ePWM1 改成 50 kHz，占空比与相位语义保持不变
EPWM_setDuty(1, 62.5f);        // ePWM1A 占空比 62.5%
EPWM_setPhase(2, 120.0f);      // ePWM2 相对主通道移相 120°

float    f = EPWM_actualFswKhz(1);          // 回读实际频率（TBPRD 取整后）
uint16_t c = EPWM_lastCmpa(1);              // 最近写入的 CMPA，调试用
const EPWM_API_Param *p = EPWM_getParam(1); // 当前参数快照
```

成组更新（闭环里常用，减少中间态）：

```c
EPWM_API_Param sp = { 100.0f, 45.0f, 0.0f, 0, 1 };
EPWM_setParam(1, &sp);
```

通道号从 1 开始；越界调用会被忽略（不会写坏别的通道）。

---

## 3. 保证

1. **改频率时自动保持占空比与相位** —— 内部按 `dutyPct` / `phaseDeg` 重算 `CMPA` / `TBPHS`。
2. **`CMPA` 始终夹在 `[1, TBPRD-1]`** —— 不会出现 0% / 100% 导致的恒定输出。
3. **所有写入进影子寄存器** —— `TBPRD`、`CMPA`、`TBPHS` 都在 `CTR=0` / 同步事件统一生效，不切毛刺。
4. **占空比范围 0.5% ~ 99.5%**，与工具界面一致。

---

## 4. 限制（重要）

| 限制 | 说明 | 怎么办 |
| --- | --- | --- |
| 分频固定 | `CLKDIV/HSPCLKDIV` 在初始化时定死，API 只改 `TBPRD` | 需要更宽频率范围时，在工具里选好分频再生成；或自行调 `EPWM_setClockPrescaler` 并重新校准 |
| 死区不可动态改 | `DBRED/DBFED` 没有影子寄存器，写入立即生效 | 死区按工况固定；确实要改就在 PWM 关断窗口内改 |
| 需要 FPU | 全是 `float` 运算 | F28004x / F2837x / F28335 都有 FPU；无 FPU 器件请改用定点版本 |
| 不校验分频落差 | 请求的频率若超出当前分频范围，会被夹到边界 | 用 `EPWM_API_FSW_MIN_KHZ` / `EPWM_API_FSW_MAX_KHZ` 先判断，或读 `EPWM_actualFswKhz()` 反查 |

---

## 5. 接入闭环：一个最小骨架

API 只负责"执行层"。控制层（采样、PI、限幅）需要你自己写，下面是一个推荐的时序骨架，
和生成代码里的寄存器配置是配套的：

```c
// 1) 采样时刻：SOC 在计数器顶点触发（工具里选 CTR_PRD）
//    此时电感电流纹波接近平均值，且离下一次 CMPA 装载还有半个周期

// 2) 控制中断：ePWM 周期中断（CTR=0），此时 CMPA 影子寄存器刚装载完
__interrupt void epwm1_isr(void)
{
    // 取上一拍 ADC 结果（一拍延迟，最省事也最稳）
    float iL   = ADC_readPhaseCurrent();
    float err  = g_iRef - iL;

    // 增量式 PI + 抗饱和
    float du   = g_kp * (err - g_errPrev) + g_ki * err;
    g_duty    += du;
    g_errPrev  = err;

    if (g_duty > 95.0f) { g_duty = 95.0f; }   // 抗积分饱和
    if (g_duty < 2.0f)  { g_duty = 2.0f;  }

    EPWM_setDuty(1, g_duty);                  // 只面对占空比，不碰寄存器

    EPwm1Regs.ETCLR.bit.INT = 1;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP3;
}
```

几个配套要点：

* **采样点与装载点错开半个周期**：`CTR=PRD` 采样 → `CTR=0` 装载，天然避免"用新占空比配旧采样"。
* **频率调节类拓扑**（LLC / PFC 变频）把 `g_duty` 换成 `EPWM_setFrequency(ch, f)`，
  同样不需要关心 TBPRD 换算；但要注意 TBPRD 取整带来的频率量化。
* **安全**：闭环必须配合 Trip-Zone。过流比较器 → `TZ1` → `TZCTL` 强制低，
  工具里已生成该配置，你只需要把故障源接到对应 TZ 引脚并在 TZ 中断里做软恢复。
* **时间预算**：20 kHz + 100 MHz 时每个周期只有 5000 个时钟周期。
  生成 ISR 里的 `sinf()` 适合演示，量产建议换查表法或把 PI 放到 CLA 上。

---

## 6. 与初始化代码的关系

```
epwm_config.c   ← 一次性初始化（频率、死区、极性、同步链）
epwm_api.c      ← 运行时改参数（频率、占空比、相位）
main.c          ← 调用两者
```

`epwm_api.c` 内部维护一份参数副本（上电时用生成值初始化），
所以**改频率后它能按原占空比重算**。如果你绕过 API 直接写寄存器，
这份副本就会失真 —— 要么全走 API，要么自己同步。
