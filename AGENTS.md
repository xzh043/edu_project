# 智慧教学系统 - AGENTS.md

## 项目概览
智慧教学系统是一个教师与学生双角色的教学管理平台。教师通过 PC 端登录，使用手机号+密码方式；学生通过手机端登录，使用学号+密码方式。登录后进入 Dashboard，包含学生管理、测评作业、数据分析、设置四个菜单模块。

## 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth

## 目录结构
```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── supabase-config/route.ts   # Supabase 配置接口
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts          # 登录接口
│   │   │   │   ├── register/route.ts       # 注册接口
│   │   │   │   ├── me/route.ts             # 用户信息接口
│   │   │   │   └── password/route.ts       # 密码修改接口
│   │   │   ├── classes/route.ts            # 班级 CRUD 接口
│   │   │   ├── students/
│   │   │   │   ├── route.ts                # 学生 CRUD 接口
│   │   │   │   └── import/route.ts         # 学生批量导入接口
│   │   │   └── courses/
│   │   │       ├── route.ts                # 课程 CRUD 接口
│   │   │       └── import/route.ts         # 课程批量导入接口
│   │   ├── teacher/
│   │   │   ├── login/page.tsx              # 教师登录页
│   │   │   └── register/page.tsx           # 教师注册页
│   │   ├── student/
│   │   │   └── login/page.tsx              # 学生登录页
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                  # Dashboard 侧边栏布局
│   │   │   ├── page.tsx                    # 默认跳转学生管理
│   │   │   ├── students/page.tsx           # 学生管理页
│   │   │   ├── assessments/page.tsx        # 测评作业页
│   │   │   ├── analytics/page.tsx          # 数据分析页
│   │   │   └── settings/page.tsx           # 设置页
│   │   ├── layout.tsx                      # 根布局
│   │   ├── page.tsx                        # 首页（角色选择）
│   │   └── globals.css                     # 全局样式
│   ├── components/
│   │   ├── navbar.tsx                      # 导航栏
│   │   ├── client-providers.tsx            # 客户端 Provider
│   │   └── ui/                             # shadcn/ui 组件
│   ├── lib/
│   │   ├── auth-context.tsx                # 认证上下文
│   │   ├── supabase-browser.ts             # Supabase 浏览器客户端
│   │   ├── supabase-config-inject.tsx      # Supabase 配置注入
│   │   └── utils.ts                        # 通用工具
│   └── storage/database/
│       ├── supabase-client.ts              # Supabase 服务端客户端
│       └── shared/schema.ts               # 数据库 Schema
```

## 核心架构

### 认证方案
- 使用 Supabase Auth 的 email+password 模式
- 教师：手机号映射为虚拟邮箱 `{phone}@teacher.edusys`
- 学生：学号映射为虚拟邮箱 `{studentId}@student.edusys`
- **重要**：登录 API 必须使用 service role key（anon key 在当前 Supabase 实例上无法调用 Auth API，返回 "Unauthorized"）
- 业务接口统一使用 service role key（绕过 RLS），不需要客户端传递 token

### 数据库表
- `health_check`: 健康检查（id SERIAL, updated_at TIMESTAMPTZ）
- `profiles`: 用户扩展信息（id, user_id→auth.users, role, name, phone, employee_id, student_id, created_at, updated_at）
- `classes`: 班级信息（id, name, created_by, created_at）
- `students`: 学生信息（id, class_id→classes, student_number, name, created_by, created_at, updated_by, updated_at）
  - students.class_id 外键关联 classes.id
  - students.student_number 唯一约束
- `courses`: 课程知识点（id, chapter_name, knowledge_name, created_by, created_at, updated_by, updated_at）
- **RLS 已禁用**：所有表 DISABLE ROW LEVEL SECURITY
- **Supabase 实例**：使用平台提供的实例（`br-vivid-lynx`），`.env` 文件已同步为平台凭证

### Dashboard 导航
- 侧边栏 4 个菜单：学生管理、测评作业、数据分析、设置
- 默认加载学生管理（/dashboard → /dashboard/students）
- 侧边栏顶部显示当前用户姓名，底部退出按钮（二次确认）

### 学生管理模块
- 左侧班级树（根节点"全部"，点击筛选班级学生）
- 右侧学生列表（班级、学号、姓名、创建人员、创建时间、修改人员、修改时间）
- 列表排序：班级名正序 + 学号正序
- 模糊搜索：按姓名或学号搜索
- 新增学生：班级、学号、姓名；记录创建人员和创建时间
- 编辑学生：修改班级、学号、姓名；记录修改人员和修改时间
- 删除学生：物理删除（AlertDialog 二次确认）
- 查看学生：Dialog 展示基本信息
- 批量导入：上传 Excel 文件（表头：班级、学号、姓名、初始密码），支持数据预览、班级自动创建、学号重复校验、导入结果统计

### 设置模块
- 账号管理：显示当前账号基本信息（姓名、工号、手机号），提供密码修改功能（6位以上）
- 课程管理：按章节分组展示课程知识点，支持新增/编辑/删除知识点
- 课程批量导入：上传《课程信息.xlsx》（表头：章节名称、知识点名称），支持数据预览和导入结果统计
- 课程下载模板：提供标准 Excel 模板下载

### 登录态管理
- 前端：AuthContext + localStorage 缓存用户信息
- 后端：`x-session` header 携带 Supabase access_token
- Supabase 浏览器客户端自动管理 session 刷新

## 构建与运行命令
- 安装依赖：`pnpm install`
- 开发：`pnpm run dev`
- 构建：`pnpm run build`
- 生产运行：`pnpm run start`
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint`

## 编码规范
- TypeScript strict 模式
- 字段名使用 snake_case（数据库层）
- 所有 Supabase 操作必须检查 error 并 throw
- React 组件优先使用函数式组件
- 使用 'use client' 标记客户端组件
- 禁止隐式 any

## API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/supabase-config | 获取 Supabase 配置 | 否 |
| POST | /api/auth/login | 登录（teacher/student） | 否 |
| POST | /api/auth/register | 教师注册 | 否 |
| GET | /api/auth/me | 获取当前用户信息 | 是 |
| GET | /api/classes | 获取班级列表 | 是 |
| POST | /api/classes | 新增班级 | 是 |
| GET | /api/students | 获取学生列表（支持 class_id/keyword 参数） | 是 |
| POST | /api/students | 新增学生 | 是 |
| PUT | /api/students | 修改学生 | 是 |
| DELETE | /api/students?id=xxx | 删除学生 | 是 |
| POST | /api/students/import | 批量导入学生（Excel） | 是 |
| PUT | /api/auth/password | 修改密码 | 是 |
| GET | /api/courses | 获取课程列表 | 是 |
| POST | /api/courses | 新增课程知识点 | 是 |
| PUT | /api/courses | 修改课程知识点 | 是 |
| DELETE | /api/courses?id=xxx | 删除课程知识点 | 是 |
| POST | /api/courses/import | 批量导入课程（Excel） | 是 |

## 预览链路配置

### 项目类型判定
- **project_type**: `web`
- **判定依据**: Next.js 16 全栈应用，包含前端页面和 API 路由，核心结果需要通过浏览器访问验证

### 预览入口
- **dev.build**: `bash projects/scripts/prepare.sh`（根目录调用）/ `bash ./scripts/prepare.sh`（子项目内调用）
- **dev.run**: `bash projects/scripts/dev.sh`（根目录调用）/ `bash ./scripts/dev.sh`（子项目内调用）
- **预览端口**: 5000
- **绑定地址**: 0.0.0.0（IPv4 全接口）

### .coze 映射关系
- **根 .coze** (`/workspace/projects/.coze`): 平台最终读取的入口，`[dev]` 和 `[deploy]` 路径指向 `projects/scripts/*`
- **子项目 .coze** (`/workspace/projects/projects/.coze`): 记录子项目自身配置，`[dev]` 和 `[deploy]` 路径指向 `./scripts/*`
- **脚本定位**: 所有脚本使用 `SCRIPT_DIR` 推导 `PROJECT_DIR`，确保从任意工作目录调用都能正确定位到项目根目录

### 服务器配置
- **入口文件**: `src/server.ts`
- **默认 hostname**: `0.0.0.0`（已修改，原为 `localhost`）
- **默认端口**: 5000
- **开发模式**: 使用 `tsx watch` 实现热更新

### 注意事项
1. Supabase 环境变量已配置在 `.env` 文件中（`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`）
2. service role key 用于绕过 RLS 和 Auth 限制，注册/登录操作需要此 key
3. 脚本已修改为基于脚本位置定位项目目录，不再依赖 `COZE_WORKSPACE_PATH` 环境变量
4. 部署配置已添加 `[deploy.profile]`，`kind = "service"`，`flavor = "web"`

## Coze 工作流集成

### 认证方式
- 使用 Coze OAuth JWT 认证（jsonwebtoken 库签发 RS256 JWT）
- `grant_type`: `urn:ietf:params:oauth:grant-type:jwt-bearer`
- 私钥/Client ID/Public Key ID 从环境变量读取

### 工作流列表
| Workflow ID | 用途 | 参数 | 调用方 |
|---|---|---|---|
| `7657546910882283526` | 学生整体AI学习建议 | id_number(学号), content(错题记录) | 学生详情页 |
| `7657555437513179187` | 作业/任务维度AI建议 | content(错题记录) | 作业详情页、学生任务结果页 |
| `7657465645978877994` | 知识点提问分布 | id_number, class, type, chapter | 学生详情(热点提问)、数据分析(章节分布) |

### AI建议存储
- `ai_suggestions` 表：student_id, student_number, content, assignment_id(nullable), created_at
- `assignment_ai_suggestions` 表：assignment_id, content, created_at
- 每个 student_number + assignment_id 组合只保留一条建议（重新生成时先删旧再插新）

### 响应解析
Coze 工作流返回三层嵌套 JSON：`data(string) → JSON.parse → output(string/content)`
