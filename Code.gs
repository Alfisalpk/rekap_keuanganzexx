const APP = {
  title: "REKAP KEUANGAN ZEXX",
  version: "1.0.0",
  sheets: { users: "Pengguna", transactions: "Transaksi", loans: "Peminjaman" },
  scopes: ["tabungan", "umroh"],
};
const HEADERS = {
  Pengguna: [
    "id",
    "nama",
    "username",
    "passwordHash",
    "role",
    "aktif",
    "dibuatPada",
  ],
  Transaksi: [
    "id",
    "kode",
    "ruang",
    "tanggal",
    "jenis",
    "kategori",
    "jumlah",
    "keterangan",
    "dicatatOleh",
    "dibuatPada",
    "diubahPada",
  ],
  Peminjaman: [
    "id",
    "kode",
    "ruang",
    "tanggal",
    "peminjam",
    "jumlah",
    "terbayar",
    "keterangan",
    "status",
    "dicatatOleh",
    "dibuatPada",
    "diubahPada",
  ],
};
const CATEGORIES = [
  "Gaji",
  "Tabungan",
  "Jajan",
  "Makanan",
  "Transportasi",
  "Tagihan",
  "Belanja",
  "Kesehatan",
  "Pendidikan",
  "Umroh",
  "Pengembalian Pinjaman",
  "Lainnya",
];
function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle(APP.title)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
/** Jalankan sekali dari editor Apps Script; simpan spreadsheet dan kredensial admin di Script Properties. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SPREADSHEET_ID");
  if (!id) {
    const ss = SpreadsheetApp.create("Data Rekap Keuangan ZEXX");
    id = ss.getId();
    props.setProperty("SPREADSHEET_ID", id);
  }
  const ss = SpreadsheetApp.openById(id);
  const users = ensureSheet_(ss, APP.sheets.users, HEADERS[APP.sheets.users]);
  const transactions = ensureSheet_(
    ss,
    APP.sheets.transactions,
    HEADERS[APP.sheets.transactions],
  );
  const loans = ensureSheet_(ss, APP.sheets.loans, HEADERS[APP.sheets.loans]);
  if (users.getLastRow() < 2) {
    const username = "admin",
      password = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    users.appendRow([
      1,
      "Administrator",
      username,
      hashPassword_(password),
      "admin",
      true,
      new Date(),
    ]);
    props.setProperty("INITIAL_ADMIN_PASSWORD", password);
    Logger.log(
      "Login awal: " +
        username +
        " / " +
        password +
        " — segera ubah kata sandi setelah masuk.",
    );
  }
  props.setProperty("NEXT_USER_ID", String(Math.max(1, users.getLastRow())));
  props.setProperty(
    "NEXT_TX_ID",
    String(nextNumericId_(transactions)),
  );
  props.setProperty(
    "NEXT_LOAN_ID",
    String(nextNumericId_(loans)),
  );
  return (
    "Setup selesai. Spreadsheet: " +
    ss.getUrl() +
    ". Lihat Executions > Logs untuk kredensial admin pertama."
  );
}
/** Reset password admin yang tidak lagi diketahui. Lihat kredensial di Execution log. */
function resetAdminPassword() {
  const users = rows_(APP.sheets.users);
  const admin = users.find((user) => user.role === "admin");
  if (!admin) {
    throw new Error("Akun admin belum ada. Jalankan setup() terlebih dahulu.");
  }

  const password = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const usersSheet = sheet_(APP.sheets.users);
  usersSheet.getRange(admin._row, 4).setValue(hashPassword_(password));
  usersSheet.getRange(admin._row, 6).setValue(true);
  Logger.log("Login admin: " + admin.username + " / " + password);
  return "Kata sandi admin direset. Lihat Execution log untuk kredensial baru.";
}
function ensureSheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!headers || headers.length === 0) {
    throw new Error("Header untuk sheet '" + name + "' tidak tersedia.");
  }
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#eef2ff");
  sh.setFrozenRows(1);
  return sh;
}
function login(username, password) {
  const user = rows_(APP.sheets.users).find(
    (u) =>
      String(u.username).toLowerCase() ===
        String(username).trim().toLowerCase() &&
      u.aktif === true &&
      verifyPassword_(password, u.passwordHash),
  );
  if (!user) throw new Error("Username atau kata sandi tidak sesuai.");
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    "session:" + token,
    JSON.stringify({
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
    }),
    21600,
  );
  return {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
    },
  };
}
function logout(token) {
  if (token) CacheService.getScriptCache().remove("session:" + token);
  return true;
}
function api(token, action, payload) {
  const user = requireUser_(token),
    data = payload || {};
  switch (action) {
    case "bootstrap":
      return bootstrap_(user, data.ruang || "tabungan");
    case "saveTransaction":
      return saveTransaction_(user, data);
    case "saveTransactionsBulk":
      return saveTransactionsBulk_(user, data);
    case "deleteTransaction":
      return deleteRow_(user, APP.sheets.transactions, data.id);
    case "saveLoan":
      return saveLoan_(user, data);
    case "repayLoan":
      return repayLoan_(user, data);
    case "deleteLoan":
      return deleteRow_(user, APP.sheets.loans, data.id);
    case "saveUser":
      return saveUser_(user, data);
    case "deleteUser":
      return deleteUser_(user, data.id);
    case "changePassword":
      return changePassword_(user, data);
    case "export":
      return exportData_(user, data);
    default:
      throw new Error("Aksi tidak dikenal.");
  }
}
function bootstrap_(user, ruang) {
  if (!APP.scopes.includes(ruang))
    throw new Error("Ruang keuangan tidak valid.");
  const transactions = rows_(APP.sheets.transactions)
    .filter((x) => x.ruang === ruang)
    .sort(
      (a, b) =>
        String(b.tanggal).localeCompare(String(a.tanggal)) || b.id - a.id,
    );
  const loans = rows_(APP.sheets.loans)
    .filter((x) => x.ruang === ruang)
    .sort(
      (a, b) =>
        String(b.tanggal).localeCompare(String(a.tanggal)) || b.id - a.id,
    );
  const activeLoans = loans.filter((x) => x.status !== "Lunas");
  const income = sum_(
    transactions.filter((x) => x.jenis === "masuk" && !isRepayment_(x)),
  );
  const repayments = sum_(transactions.filter(isRepayment_));
  const expense = sum_(transactions.filter((x) => x.jenis === "keluar"));
  const borrowed = sum_(loans),
    outstanding = activeLoans.reduce(
      (s, x) => s + Math.max(0, Number(x.jumlah) - Number(x.terbayar)),
      0,
    );
  const month = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM",
  );
  const monthly = transactions.filter(
    (x) => String(x.tanggal).slice(0, 7) === month,
  );
  const users =
    user.role === "admin"
      ? rows_(APP.sheets.users).map(({ passwordHash, ...safe }) => safe)
      : [];
  return {
    user,
    ruang,
    transactions,
    loans,
    users,
    categories: CATEGORIES,
    summary: {
      income,
      repayments,
      expense,
      balance: income + repayments - expense,
      borrowed,
      outstanding,
      monthIncome: sum_(
        monthly.filter((x) => x.jenis === "masuk" && !isRepayment_(x)),
      ),
      monthRepayments: sum_(monthly.filter(isRepayment_)),
      monthExpense: sum_(monthly.filter((x) => x.jenis === "keluar")),
      txCount: transactions.length,
      openLoans: activeLoans.length,
    },
    updatedAt: new Date().toISOString(),
  };
}
function saveTransaction_(user, d) {
  validateEntry_(d);
  const sh = sheet_(APP.sheets.transactions),
    id = Number(d.id) || nextId_("NEXT_TX_ID", sh),
    now = new Date();
  const code = "TX-" + String(id).padStart(3, "0"),
    old = findById_(sh, id);
  const row = [
    id,
    code,
    scope_(d.ruang),
    date_(d.tanggal),
    d.jenis,
    clean_(d.kategori, 50),
    Number(d.jumlah),
    clean_(d.keterangan, 500),
    clean_(d.dicatatOleh || user.nama, 80),
    old ? old.dibuatPada : now,
    now,
  ];
  writeById_(sh, id, row);
  return { id, kode: code };
}
function saveTransactionsBulk_(user, d) {
  const items = Array.isArray(d.transactions) ? d.transactions : [];
  if (!items.length) throw new Error("Tambahkan minimal satu baris transaksi.");
  if (items.length > 100)
    throw new Error("Maksimal 100 transaksi dalam satu kali simpan.");

  const ruang = scope_(d.ruang);
  items.forEach((item) => validateEntry_(item));

  const sh = sheet_(APP.sheets.transactions);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    let id = Math.max(
      Number(props.getProperty("NEXT_TX_ID")) || 1,
      nextNumericId_(sh),
    );
    const now = new Date();
    const rows = items.map((item) => {
      const currentId = id++;
      return [
        currentId,
        "TX-" + String(currentId).padStart(3, "0"),
        ruang,
        date_(item.tanggal),
        item.jenis,
        clean_(item.kategori, 50),
        Number(item.jumlah),
        clean_(item.keterangan, 500),
        clean_(item.dicatatOleh || user.nama, 80),
        now,
        now,
      ];
    });
    const firstRow = sh.getLastRow() + 1;
    sh.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);
    props.setProperty("NEXT_TX_ID", String(id));
    return { count: rows.length, firstId: id - rows.length, lastId: id - 1 };
  } finally {
    lock.releaseLock();
  }
}
function saveLoan_(user, d) {
  const amount = Number(d.jumlah);
  if (!d.tanggal || !d.peminjam || !(amount > 0) || !d.keterangan)
    throw new Error(
      "Tanggal, nama peminjam, jumlah, dan keterangan wajib diisi.",
    );
  const sh = sheet_(APP.sheets.loans),
    id = Number(d.id) || nextId_("NEXT_LOAN_ID", sh),
    old = findById_(sh, id),
    paid = old ? Number(old.terbayar) : 0,
    now = new Date();
  writeById_(sh, id, [
    id,
    "PN-" + String(id).padStart(3, "0"),
    scope_(d.ruang),
    date_(d.tanggal),
    clean_(d.peminjam, 100),
    amount,
    paid,
    clean_(d.keterangan, 500),
    paid >= amount ? "Lunas" : "Belum lunas",
    clean_(d.dicatatOleh || user.nama, 80),
    old ? old.dibuatPada : now,
    now,
  ]);
  if (!old)
    saveTransaction_(user, {
      ruang: d.ruang,
      tanggal: d.tanggal,
      jenis: "keluar",
      kategori: "Pinjaman",
      jumlah: amount,
      keterangan: "Pinjaman ke " + d.peminjam + " — " + d.keterangan,
      dicatatOleh: user.nama,
    });
  return { id, kode: "PN-" + String(id).padStart(3, "0") };
}
function repayLoan_(user, d) {
  const sh = sheet_(APP.sheets.loans),
    loan = findById_(sh, Number(d.id)),
    amount = Number(d.jumlah);
  if (!loan) throw new Error("Data pinjaman tidak ditemukan.");
  const remaining = Number(loan.jumlah) - Number(loan.terbayar);
  if (!(amount > 0) || amount > remaining)
    throw new Error(
      "Jumlah pengembalian harus lebih dari nol dan tidak melebihi sisa pinjaman.",
    );
  const paid = Number(loan.terbayar) + amount;
  writeById_(sh, loan.id, [
    loan.id,
    loan.kode,
    loan.ruang,
    loan.tanggal,
    loan.peminjam,
    loan.jumlah,
    paid,
    loan.keterangan,
    paid >= loan.jumlah ? "Lunas" : "Belum lunas",
    loan.dicatatOleh,
    loan.dibuatPada,
    new Date(),
  ]);
  saveTransaction_(user, {
    ruang: loan.ruang,
    tanggal: d.tanggal || today_(),
    jenis: "masuk",
    kategori: "Pengembalian Pinjaman",
    jumlah: amount,
    keterangan: "Pengembalian " + loan.kode + " dari " + loan.peminjam,
    dicatatOleh: user.nama,
  });
  return true;
}
function saveUser_(user, d) {
  adminOnly_(user);
  const sh = sheet_(APP.sheets.users),
    id = Number(d.id) || nextId_("NEXT_USER_ID", sh),
    old = findById_(sh, id),
    username = clean_(d.username, 50).toLowerCase(),
    nama = clean_(d.nama, 100);
  if (!username || !nama) throw new Error("Nama dan username wajib diisi.");
  if (
    rows_(APP.sheets.users).some(
      (x) => x.username === username && Number(x.id) !== id,
    )
  )
    throw new Error("Username sudah digunakan.");
  if (!old && !d.password)
    throw new Error("Kata sandi wajib diisi untuk pengguna baru.");
  const row = [
    id,
    nama,
    username,
    d.password ? hashPassword_(d.password) : old.passwordHash,
    old && old.role === "admin" ? "admin" : "pengguna",
    d.aktif !== false,
    old ? old.dibuatPada : new Date(),
  ];
  writeById_(sh, id, row);
  return id;
}
function deleteUser_(user, d) {
  adminOnly_(user);
  if (Number(d.id) === Number(user.id))
    throw new Error("Akun yang sedang digunakan tidak dapat dihapus.");
  const sh = sheet_(APP.sheets.users),
    row = findById_(sh, Number(d.id));
  if (!row) return false;
  sh.deleteRow(row._row);
  return true;
}
function changePassword_(user, d) {
  const old = String(d.passwordLama || ""),
    next = String(d.passwordBaru || "");
  const sh = sheet_(APP.sheets.users),
    row = findById_(sh, user.id);
  if (!row || !verifyPassword_(old, row.passwordHash))
    throw new Error("Kata sandi lama tidak sesuai.");
  if (next.length < 8) throw new Error("Kata sandi baru minimal 8 karakter.");
  sh.getRange(row._row, 4).setValue(hashPassword_(next));
  return true;
}
function deleteRow_(user, name, id) {
  const sh = sheet_(name),
    row = findById_(sh, Number(id));
  if (row) sh.deleteRow(row._row);
  return true;
}
function exportData_(user, d) {
  const ruang = scope_(d.ruang),
    type = d.format === "pdf" ? "pdf" : "xlsx",
    ss = SpreadsheetApp.create("Ekspor ZEXX " + ruang),
    tx = rows_(APP.sheets.transactions).filter((x) => x.ruang === ruang),
    loans = rows_(APP.sheets.loans).filter((x) => x.ruang === ruang);
  const fill = (name, head, data) => {
    const sh =
      ss.getSheets()[0].getName() === "Sheet1"
        ? ss.getSheets()[0]
        : ss.insertSheet();
    sh.setName(name);
    sh.getRange(1, 1, 1, head.length)
      .setValues([head])
      .setFontWeight("bold")
      .setBackground("#eef2ff");
    if (data.length)
      sh.getRange(2, 1, data.length, head.length).setValues(data);
    sh.autoResizeColumns(1, head.length);
  };
  fill(
    "Transaksi",
    [
      "ID",
      "Kode",
      "Ruang",
      "Tanggal",
      "Jenis",
      "Kategori",
      "Jumlah",
      "Keterangan",
      "Dicatat oleh",
    ],
    tx.map((x) => [
      x.id,
      x.kode,
      x.ruang,
      x.tanggal,
      x.jenis,
      x.kategori,
      x.jumlah,
      x.keterangan,
      x.dicatatOleh,
    ]),
  );
  const sh = ss.insertSheet("Peminjaman");
  sh.getRange(1, 1, 1, 9)
    .setValues([
      [
        "ID",
        "Kode",
        "Tanggal",
        "Peminjam",
        "Jumlah",
        "Terbayar",
        "Sisa",
        "Keterangan",
        "Status",
      ],
    ])
    .setFontWeight("bold")
    .setBackground("#eef2ff");
  if (loans.length)
    sh.getRange(2, 1, loans.length, 9).setValues(
      loans.map((x) => [
        x.id,
        x.kode,
        x.tanggal,
        x.peminjam,
        x.jumlah,
        x.terbayar,
        Math.max(0, x.jumlah - x.terbayar),
        x.keterangan,
        x.status,
      ]),
    );
  sh.autoResizeColumns(1, 9);
  const stats = ss.insertSheet("Statistik Bulanan");
  const monthlyRows = [];
  const now = new Date();
  for (let offset = 11; offset >= 0; offset--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = Utilities.formatDate(
      monthDate,
      Session.getScriptTimeZone(),
      "yyyy-MM",
    );
    const monthTx = tx.filter(
      (x) => String(x.tanggal).slice(0, 7) === monthKey,
    );
    const monthIncome = sum_(
      monthTx.filter((x) => x.jenis === "masuk" && !isRepayment_(x)),
    );
    const monthRepayments = sum_(monthTx.filter(isRepayment_));
    const monthExpense = sum_(monthTx.filter((x) => x.jenis === "keluar"));
    monthlyRows.push([
      Utilities.formatDate(monthDate, Session.getScriptTimeZone(), "MMM yyyy"),
      monthIncome,
      monthRepayments,
      monthExpense,
      monthIncome + monthRepayments - monthExpense,
    ]);
  }
  stats
    .getRange(1, 1, 1, 5)
    .setValues([
      ["Bulan", "Pemasukan", "Pengembalian pinjaman", "Pengeluaran", "Saldo kas"],
    ])
    .setFontWeight("bold")
    .setBackground("#eef2ff");
  stats.getRange(2, 1, monthlyRows.length, 5).setValues(monthlyRows);
  stats.getRange(2, 2, monthlyRows.length, 4).setNumberFormat('"Rp" #,##0');
  stats.autoResizeColumns(1, 5);
  const chart = Charts.newLineChart()
    .setDataRange(stats.getRange(1, 1, monthlyRows.length + 1, 5))
    .setOption("title", "Arus kas bulanan")
    .setOption("legend.position", "bottom")
    .setOption("height", 360)
    .setPosition(16, 1, 0, 0)
    .build();
  stats.insertChart(chart);
  SpreadsheetApp.flush();
  const mime =
    type === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const response = UrlFetchApp.fetch(
    "https://www.googleapis.com/drive/v3/files/" +
      ss.getId() +
      "/export?mimeType=" +
      encodeURIComponent(mime),
    {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    },
  );
  if (response.getResponseCode() !== 200)
    throw new Error(
      "Ekspor gagal. Coba lagi atau periksa izin Drive pada deployment.",
    );
  const result = {
    name: "Rekap-ZEXX-" + ruang + "." + type,
    mime,
    data: Utilities.base64Encode(response.getContent()),
  };
  DriveApp.getFileById(ss.getId()).setTrashed(true);
  return result;
}
function requireUser_(token) {
  const raw = CacheService.getScriptCache().get("session:" + token);
  if (!raw) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  return JSON.parse(raw);
}
function adminOnly_(u) {
  if (u.role !== "admin")
    throw new Error("Hanya admin yang dapat mengelola pengguna.");
}
function scope_(s) {
  if (!APP.scopes.includes(s)) throw new Error("Ruang keuangan tidak valid.");
  return s;
}
function validateEntry_(d) {
  if (
    !d.tanggal ||
    !["masuk", "keluar"].includes(d.jenis) ||
    !d.kategori ||
    !(Number(d.jumlah) > 0)
  )
    throw new Error(
      "Tanggal, jenis, kategori, dan jumlah lebih dari nol wajib diisi.",
    );
}
function date_(s) {
  const d = new Date(String(s) + "T12:00:00");
  if (isNaN(d)) throw new Error("Tanggal tidak valid.");
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function today_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
}
function clean_(s, n) {
  return String(s || "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, n);
}
function hashPassword_(s) {
  const salt = Utilities.getUuid() + Utilities.getUuid();
  return salt + "$" + digest_(salt + String(s));
}
function verifyPassword_(password, stored) {
  const parts = String(stored || "").split("$");
  return (
    parts.length === 2 && parts[1] === digest_(parts[0] + String(password))
  );
}
function digest_(s) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s),
    Utilities.Charset.UTF_8,
  )
    .map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
}
function sum_(a) {
  return a.reduce((s, x) => s + Number(x.jumlah || 0), 0);
}
function spreadsheet_() {
  const id =
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id)
    throw new Error(
      "Database belum disiapkan. Jalankan setup() terlebih dahulu.",
    );
  return SpreadsheetApp.openById(id);
}
function sheet_(n) {
  const sh = spreadsheet_().getSheetByName(n);
  if (!sh) {
    throw new Error(
      "Sheet '" + n + "' tidak ditemukan. Jalankan setup() untuk membuat tab database.",
    );
  }
  return sh;
}
function rows_(sheetOrName) {
  const sh =
    typeof sheetOrName === "string" ? sheet_(sheetOrName) : sheetOrName;
  if (!sh) {
    throw new Error("Sheet database tidak ditemukan. Jalankan setup() kembali.");
  }
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const heads = values[0];
  return values
    .slice(1)
    .map((r, i) => {
      const o = { _row: i + 2 };
      heads.forEach(
        (h, j) =>
          (o[h] =
            r[j] instanceof Date
              ? Utilities.formatDate(
                  r[j],
                  Session.getScriptTimeZone(),
                  "yyyy-MM-dd",
                )
              : r[j]),
      );
      return o;
    })
    .filter((o) => o.id !== "" && o.id != null);
}
function findById_(sh, id) {
  return rows_(sh).find((x) => Number(x.id) === Number(id)) || null;
}
function nextNumericId_(sh) {
  const a = rows_(sh).map((x) => Number(x.id) || 0);
  return Math.max(0, ...a) + 1;
}
function nextId_(key, sh) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = PropertiesService.getScriptProperties(),
      id = Math.max(Number(p.getProperty(key)) || 1, nextNumericId_(sh));
    p.setProperty(key, String(id + 1));
    return id;
  } finally {
    lock.releaseLock();
  }
}
function isRepayment_(transaction) {
  return (
    transaction.jenis === "masuk" &&
    transaction.kategori === "Pengembalian Pinjaman"
  );
}
function writeById_(sh, id, row) {
  const old = findById_(sh, id);
  if (old) sh.getRange(old._row, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}
