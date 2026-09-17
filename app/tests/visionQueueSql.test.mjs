import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  CREATE_QUEUE_SCHEMA_SQL,
  SELECT_READY_ITEMS_SQL,
  SELECT_UNOWNED_FEEDBACK_SQL,
} from '../src/vision/visionQueueSql.ts';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(CREATE_QUEUE_SCHEMA_SQL);
  return db;
}

function add(db, id, type, eventId, userId, createdAtMs) {
  db.prepare(`insert into vision_queue
    (id,type,event_id,user_id,created_at_ms,payload) values (?,?,?,?,?,?)`)
    .run(id, type, eventId, userId, createdAtMs, '{}');
}

test('seleção respeita conta e aguarda evento referenciado', () => {
  const db = database();
  try {
    add(db, 'event_1', 'event', '1', 'a', 1);
    add(db, 'feedback_1', 'feedback', '1', 'a', 2);
    add(db, 'feedback_2', 'feedback', '2', 'a', 3);
    add(db, 'event_3', 'event', '3', 'b', 4);
    assert.deepEqual(db.prepare(SELECT_READY_ITEMS_SQL).all('a', 'event', 'event', 100).map((row) => row.id), ['event_1']);
    assert.deepEqual(db.prepare(SELECT_READY_ITEMS_SQL).all('a', 'feedback', 'feedback', 100).map((row) => row.id), ['feedback_2']);
    db.prepare('delete from vision_queue where id = ?').run('event_1');
    assert.deepEqual(db.prepare(SELECT_READY_ITEMS_SQL).all('a', 'feedback', 'feedback', 100).map((row) => row.id), ['feedback_1', 'feedback_2']);
  } finally {
    db.close();
  }
});

test('cursor alcança feedbacks antigos após os primeiros 100', () => {
  const db = database();
  try {
    for (let i = 0; i < 125; i++) {
      add(db, `feedback_${String(i).padStart(3, '0')}`, 'feedback', `${i}`, null, 1);
    }
    const first = db.prepare(SELECT_UNOWNED_FEEDBACK_SQL).all(-1, -1, '', 100);
    const last = first.at(-1);
    const second = db.prepare(SELECT_UNOWNED_FEEDBACK_SQL).all(last.created_at_ms, last.created_at_ms, last.id, 100);
    assert.equal(first.length, 100);
    assert.equal(second.length, 25);
    assert.equal(second[0].id, 'feedback_100');
  } finally {
    db.close();
  }
});
