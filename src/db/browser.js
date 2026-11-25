// SQLite dans le navigateur (sql.js), avec la même interface que node:sqlite : exec, prepare().run/get/all.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

// « bytes » : contenu du fichier, ou promesse de ce contenu
export async function openBrowserDb(bytes) {
  const [SQL, content] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), bytes])
  const db = new SQL.Database(new Uint8Array(content))
  const setup = () => db.run('PRAGMA foreign_keys = ON')
  setup()

  const query = (sql, params, onRow) => {
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params.map((p) => p ?? null))
      while (stmt.step()) if (onRow(stmt.getAsObject()) === false) break
    } finally {
      stmt.free()
    }
  }
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => ({
      run: (...params) => query(sql, params, () => {}),
      get(...params) {
        let row
        query(sql, params, (r) => {
          row = r
          return false
        })
        return row
      },
      all(...params) {
        const rows = []
        query(sql, params, (r) => void rows.push(r))
        return rows
      },
    }),
    // sql.js rouvre la base après un export : les réglages sont à refaire.
    export() {
      db.run('VACUUM')
      const file = db.export()
      setup()
      return file
    },
    close: () => db.close(),
  }
}
