async function main() {
  try {
    const res = await fetch('http://localhost:3000/api/dashboard/gameplan');
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
main();
