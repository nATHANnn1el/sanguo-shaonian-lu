# 三国少年录（原创 MVP）

竖屏手机优先的三国题材回合制卡牌养成网页游戏（可安装为 PWA）。全部内容原创，占位美术由 SVG 生成。

## 玩法
- 3+3 站位；战斗自动进行，按速度出手；普攻 +2 怒气，受击 +1，满 4 点自动放绝技；羁绊成员齐全加成，曹操+郭嘉可放**合击**。
- 通关解锁武将；用银两升级、用将魂石进阶；第 1 章共 10 关。

## 运行
```bash
npm install
npm run dev       # 开发（局域网可访问）
npm test          # 44 个单元/数据/平衡测试
npm run build     # 类型检查 + 生产构建 → dist/
npm run preview   # 预览生产包 http://localhost:4173
npm run e2e       # 浏览器冒烟（需 preview 在运行，需本机 Chrome）
npm run shots     # 手机视口截图 → /workspace
```

## 文档（`docs/`）
| 文档 | 内容 |
|---|---|
| `SRS.md` | 软件需求规格 |
| `architecture.md` | 架构与设计 |
| `data-model.md` | 实体、JSON Schema、存档与版本、ER 图 |
| `battle-rules.md` | 战斗与成长规则 |
| `test-plan.md` / `test-results.json` | 测试计划与结果 |
| `CHANGELOG.md` | 更新日志 |
| `dev-log.md` | 决策与问题记录 |
| `schema/` | JSON Schema 文件 |
