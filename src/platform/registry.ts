/**
 * 极简注册表。
 *
 * 平台化的关键不在于「数据放在数组里」，而在于：**新增能力不需要修改已有代码**。
 * 每类扩展点（器件 / 拓扑 / 校验规则 / 代码生成目标）都持有一个 Registry，
 * 内部实现与第三方扩展走同一个入口。
 *
 * 约束：
 *  - id 是稳定标识，会出现在 URL、JSON 与文件名里，发布后不要改；
 *  - 默认禁止覆盖，重复注册会抛错，避免扩展之间静默互相踩踏。
 */
export interface Registrable {
  id: string;
}

export interface RegisterOptions {
  /** 允许覆盖同 id 的已有条目（用于测试替身或用户自定义优先级） */
  override?: boolean;
}

export class Registry<T extends Registrable> {
  private readonly items = new Map<string, T>();

  constructor(
    /** 用于报错信息，例如 'device' / 'codegen' */
    readonly kind: string,
  ) {}

  register(item: T, options: RegisterOptions = {}): this {
    if (!item || typeof item.id !== 'string' || item.id.length === 0) {
      throw new Error(`[${this.kind}] 注册项缺少合法的 id`);
    }
    if (this.items.has(item.id) && !options.override) {
      throw new Error(`[${this.kind}] id "${item.id}" 已存在；如确需覆盖请传 { override: true }`);
    }
    this.items.set(item.id, item);
    return this;
  }

  registerAll(items: T[], options: RegisterOptions = {}): this {
    items.forEach(item => this.register(item, options));
    return this;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /** 取不到就抛错，用于「必须有」的场景（默认器件、默认代码目标等） */
  require(id: string): T {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`[${this.kind}] 未注册 id "${id}"；已注册：${this.ids().join(', ') || '(空)'}`);
    }
    return item;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** 移除一个注册项，返回是否确实移除了。主要用于测试替身与用户自定义覆盖。 */
  unregister(id: string): boolean {
    return this.items.delete(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }

  get size(): number {
    return this.items.size;
  }
}

export function createRegistry<T extends Registrable>(kind: string): Registry<T> {
  return new Registry<T>(kind);
}

/** 把注册表转成 { id: item } 的普通对象，便于老代码按 key 取值 */
export function toRecord<T extends Registrable>(registry: Registry<T>): Record<string, T> {
  return Object.fromEntries(registry.list().map(item => [item.id, item]));
}
