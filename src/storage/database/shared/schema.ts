import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, timestamp, index, foreignKey } from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户资料表 - 存储教师和学生的扩展信息
export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    employee_id: varchar("employee_id", { length: 50 }),
    student_id: varchar("student_id", { length: 50 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("profiles_user_id_idx").on(table.user_id),
    index("profiles_role_idx").on(table.role),
    index("profiles_phone_idx").on(table.phone),
    index("profiles_employee_id_idx").on(table.employee_id),
    index("profiles_student_id_idx").on(table.student_id),
  ]
);

// 班级表
export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    created_by: varchar("created_by", { length: 128 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("classes_name_idx").on(table.name),
  ]
);

// 学生表
export const students = pgTable(
  "students",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    class_id: varchar("class_id", { length: 36 }).notNull(),
    student_number: varchar("student_number", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 128 }).notNull(),
    created_by: varchar("created_by", { length: 128 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_by: varchar("updated_by", { length: 128 }),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("students_class_id_idx").on(table.class_id),
    index("students_student_number_idx").on(table.student_number),
    index("students_name_idx").on(table.name),
    foreignKey({
      columns: [table.class_id],
      foreignColumns: [classes.id],
      name: "fk_students_class",
    }),
  ]
);

// 课程知识点表
export const courses = pgTable(
  "courses",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    chapter_name: varchar("chapter_name", { length: 256 }).notNull(),
    knowledge_name: varchar("knowledge_name", { length: 256 }).notNull(),
    created_by: varchar("created_by", { length: 128 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_by: varchar("updated_by", { length: 128 }),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("courses_chapter_name_idx").on(table.chapter_name),
  ]
);
