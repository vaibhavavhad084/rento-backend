import fetch from 'node-fetch';

const base = 'http://localhost:3000';
const email = 'testuser@example.com';
const password = 'Password123';

const login = async () => {
  const res = await fetch(`${base}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
};

const register = async () => {
  const res = await fetch(`${base}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password })
  });
  return res.json();
};

const order = async (token) => {
  const body = {
    amount: 100,
    carId: '000000000000000000000000',
    pickupDate: '2026-05-01',
    returnDate: '2026-05-03'
  };
  const res = await fetch(`${base}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log('order status', res.status, text);
};

const run = async () => {
  let data = await login();
  console.log('login:', data);
  if (!data.success) {
    data = await register();
    console.log('register:', data);
    if (!data.success) return;
  }
  const token = data.token;
  await order(token);
};

run().catch(console.error);
