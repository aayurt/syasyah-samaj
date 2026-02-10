module.exports = {
  apps: [
    {
      name: 'afno-events',
      script: '.next/standalone/server.js',
      instances: 'max',
      exec_mode: 'cluster',

      // 🟢 SAFETY 1: Restart process if it exceeds a limit (e.g., 1GB)
      // This is a "hard reset" to clear memory leaks.
      max_memory_restart: '1G',

      // 🟢 SAFETY 2: Tell Node/V8 to be aggressive with garbage collection
      // --max-old-space-size: Sets the limit where Node starts GC heavily.
      // --gc-interval: Frequency of the garbage collector.
      node_args: '--max-old-space-size=1024',

      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
}
