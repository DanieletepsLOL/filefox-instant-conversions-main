// ============================================================
// Sistema de migraciones automáticas para Filefox
// ============================================================
// Cada migración se ejecuta una sola vez y queda registrada en la tabla _migrations
// Si una columna ya existe, el error se ignora silenciosamente.
// ============================================================

const MIGRATIONS_TABLE = "_migrations";

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

function isApplied(db, name) {
  const row = db.prepare(`SELECT id FROM ${MIGRATIONS_TABLE} WHERE name = ?`).get(name);
  return !!row;
}

function markApplied(db, name) {
  db.prepare(`INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(name);
}

// ============================================================
// Lista de migraciones
// ============================================================
const migrations = [
  {
    name: "001_users_extra_columns",
    up(db) {
      const run = (sql) => { try { db.exec(sql); } catch (e) { /* columna ya existe */ } };
      run("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
      run("ALTER TABLE users ADD COLUMN conversions_today INTEGER DEFAULT 0");
      run("ALTER TABLE users ADD COLUMN last_conversion_date TEXT");
      run("ALTER TABLE users ADD COLUMN total_conversions INTEGER DEFAULT 0");
      run("ALTER TABLE users ADD COLUMN updated_at TEXT");
      run("ALTER TABLE users ADD COLUMN last_login_ip TEXT");
      run("ALTER TABLE users ADD COLUMN last_login_at TEXT");
      run("ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0");
      run("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email'");
      run("ALTER TABLE users ADD COLUMN locale TEXT");
      run("ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0");
      run("ALTER TABLE users ADD COLUMN deleted_at TEXT");
    },
  },
  {
    name: "002_admin_tokens",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          description TEXT DEFAULT '',
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);
    },
  },
  {
    name: "003_indexes",
    up(db) {
      try { db.exec("CREATE INDEX IF NOT EXISTS idx_activity_user_email ON activity_logs(user_email)"); } catch (e) {}
      try { db.exec("CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at)"); } catch (e) {}
      try { db.exec("CREATE INDEX IF NOT EXISTS idx_conversions_user ON conversions(user_id)"); } catch (e) {}
      try { db.exec("CREATE INDEX IF NOT EXISTS idx_conversions_email ON conversions(user_email)"); } catch (e) {}
    },
  },
  {
    name: "004_conversions_extra",
    up(db) {
      try { db.exec("ALTER TABLE conversions ADD COLUMN download_count INTEGER DEFAULT 0"); } catch (e) {}
      try { db.exec("ALTER TABLE conversions ADD COLUMN ip TEXT"); } catch (e) {}
    },
  },
];

// ============================================================
// Ejecutar migraciones pendientes
// ============================================================
export function runMigrations(db) {
  ensureMigrationsTable(db);

  let count = 0;
  for (const m of migrations) {
    if (!isApplied(db, m.name)) {
      console.log(`  → Migración: ${m.name}`);
      try {
        m.up(db);
        markApplied(db, m.name);
        count++;
      } catch (err) {
        console.error(`  ✗ Error en migración ${m.name}: ${err.message}`);
      }
    }
  }

  if (count === 0) {
    console.log("  ✓ Base de datos actualizada (sin migraciones pendientes)");
  } else {
    console.log(`  ✓ ${count} migración(es) aplicada(s)`);
  }
}

