export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Test Page Works!</h1>
      <p>If you see this, routing is working correctly.</p>
      <p>
        <a href="/api/init">Test Database Connection</a>
      </p>
    </div>
  )
}
