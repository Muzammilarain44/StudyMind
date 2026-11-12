import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

// Tests run against a real MongoDB (mongodb-memory-server downloads and
// runs a real mongod binary in memory). No Atlas / production DB is used.
let mongo;
let base;
let server;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, cookieOut: res.headers.get('set-cookie') };
}

const user = { name: 'Test Student', email: 'test@studymind.local', password: 'password123' };
let cookie;

test('register success creates user, sets HttpOnly cookie, never returns passwordHash', async () => {
  const { res, json, cookieOut } = await req('/api/v1/auth/register', { method: 'POST', body: user });
  assert.equal(res.status, 201);
  assert.equal(json.user.email, user.email);
  assert.equal(json.user.name, user.name);
  assert.equal(json.user.role, 'student');
  assert.ok(!('passwordHash' in json.user));
  assert.ok(cookieOut && cookieOut.includes('studymind_token='));
  assert.ok(cookieOut.includes('HttpOnly'));
  cookie = cookieOut.split(';')[0];
});

test('duplicate email register returns 409', async () => {
  const { res, json } = await req('/api/v1/auth/register', { method: 'POST', body: user });
  assert.equal(res.status, 409);
  assert.match(json.error, /already exists/);
});

test('login with wrong password returns generic 401', async () => {
  const { res, json } = await req('/api/v1/auth/login', {
    method: 'POST',
    body: { email: user.email, password: 'wrongpassword' },
  });
  assert.equal(res.status, 401);
  assert.match(json.error, /incorrect/);
});

test('login success sets cookie and returns user without passwordHash', async () => {
  const { res, json, cookieOut } = await req('/api/v1/auth/login', {
    method: 'POST',
    body: { email: user.email, password: user.password },
  });
  assert.equal(res.status, 200);
  assert.equal(json.user.email, user.email);
  assert.ok(!('passwordHash' in json.user));
  assert.ok(cookieOut && cookieOut.includes('studymind_token='));
  cookie = cookieOut.split(';')[0];
});

test('GET /me without cookie returns 401', async () => {
  const { res } = await req('/api/v1/auth/me');
  assert.equal(res.status, 401);
});

test('GET /me with cookie returns only the logged-in user', async () => {
  const { res, json } = await req('/api/v1/auth/me', { cookie });
  assert.equal(res.status, 200);
  assert.equal(json.user.email, user.email);
  assert.ok(!('passwordHash' in json.user));
});

test('change-password with wrong current password returns 401', async () => {
  const { res } = await req('/api/v1/auth/change-password', {
    method: 'POST',
    cookie,
    body: { currentPassword: 'notmypassword', newPassword: 'newpassword123' },
  });
  assert.equal(res.status, 401);
});

test('change-password succeeds, old password stops working, new one works', async () => {
  const { res } = await req('/api/v1/auth/change-password', {
    method: 'POST',
    cookie,
    body: { currentPassword: user.password, newPassword: 'newpassword123' },
  });
  assert.equal(res.status, 200);

  const oldLogin = await req('/api/v1/auth/login', {
    method: 'POST',
    body: { email: user.email, password: user.password },
  });
  assert.equal(oldLogin.res.status, 401);

  const newLogin = await req('/api/v1/auth/login', {
    method: 'POST',
    body: { email: user.email, password: 'newpassword123' },
  });
  assert.equal(newLogin.res.status, 200);
  cookie = newLogin.cookieOut.split(';')[0];
});

test('logout clears the cookie', async () => {
  const { res, cookieOut } = await req('/api/v1/auth/logout', { method: 'POST', cookie });
  assert.equal(res.status, 200);
  assert.ok(cookieOut && cookieOut.includes('studymind_token='));
  assert.match(cookieOut, /Expires=Thu, 01 Jan 1970/);
});
