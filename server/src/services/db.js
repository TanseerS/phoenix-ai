import mysql from 'mysql2/promise';
import { getConfig } from '../utils/config.js';

// Expected schema:
//
// CREATE TABLE project_scores (
//   id               BIGINT AUTO_INCREMENT PRIMARY KEY,
//   repo_name        VARCHAR(255) NOT NULL,
//   run_date         DATE NOT NULL,
//   health_score     TINYINT UNSIGNED NOT NULL,
//   metrics          JSON,
//   recommendation   TEXT,
//   next_best_action TEXT,
//   UNIQUE KEY uniq_repo_run (repo_name, run_date)
// );
//
// CREATE TABLE run_log (
//   id            BIGINT AUTO_INCREMENT PRIMARY KEY,
//   run_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   repos_scanned INT NOT NULL,
//   status        VARCHAR(20) NOT NULL,
//   error_message TEXT
// );

let pool;

async function getPool() {
  if (!pool) {
    const config = await getConfig();
    pool = mysql.createPool({
      host: config.dbHost,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      connectionLimit: 2,
    });
  }
  return pool;
}

// rows: [{ repoName, healthScore, metrics, recommendation, nextBestAction }]
export async function saveScores(rows) {
  if (rows.length === 0) return;

  const db = await getPool();

  const placeholders = rows.map(() => '(?, CURDATE(), ?, ?, ?, ?)').join(', ');
  const values = rows.flatMap((row) => [
    row.repoName,
    row.healthScore,
    JSON.stringify(row.metrics),
    row.recommendation ?? null,
    row.nextBestAction ?? null,
  ]);

  await db.execute(
    `INSERT INTO project_scores
       (repo_name, run_date, health_score, metrics, recommendation, next_best_action)
     VALUES ${placeholders} AS new
     ON DUPLICATE KEY UPDATE
       health_score = new.health_score,
       metrics = new.metrics,
       recommendation = new.recommendation,
       next_best_action = new.next_best_action`,
    values
  );
}

export async function logRun({ reposScanned, status, error }) {
  const db = await getPool();
  await db.execute(
    'INSERT INTO run_log (repos_scanned, status, error_message) VALUES (?, ?, ?)',
    [reposScanned, status, error ?? null]
  );
}

// Scores from the most recent run before today, as Map(repo_name -> score).
export async function getPreviousScores() {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT repo_name, health_score
     FROM project_scores
     WHERE run_date = (SELECT MAX(run_date) FROM project_scores WHERE run_date < CURDATE())`
  );
  return new Map(rows.map((row) => [row.repo_name, row.health_score]));
}

export async function getScoreHistory(repoName, days) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT run_date, health_score, metrics, recommendation, next_best_action
     FROM project_scores
     WHERE repo_name = ? AND run_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY run_date ASC`,
    [repoName, days]
  );
  return rows;
}
