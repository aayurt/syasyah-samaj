module.exports = {
  apps: [
    {
      name: 'syasha-samaj',

      // The server never runs `next build` — LocalSyncDeployer.sh ships the
      // build output (.next) from the developer machine, and `pnpm install`
      // on the server refreshes the native modules (sharp etc.) for Linux.
      // So we run the shipped build with `next start` instead of the
      // standalone server, whose bundled node_modules would carry the
      // developer machine's (macOS) natives.
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8085 -H 0.0.0.0',
      cwd: __dirname,

      // `next start` binds the port itself, so a single instance (fork mode)
      // — unlike the standalone server which could cluster.
      instances: 1,
      exec_mode: 'fork',

      // 🟢 SAFETY 1: Restart process if it exceeds a limit (e.g., 1GB)
      // This is a "hard reset" to clear memory leaks.
      max_memory_restart: '1G',

      // 🟢 SAFETY 2: Tell Node/V8 to be aggressive with garbage collection
      // --max-old-space-size: Sets the limit where Node starts GC heavily.
      // --gc-interval: Frequency of the garbage collector.
      node_args: '--max-old-space-size=300',

      env: {
        NODE_ENV: 'production',
        PORT: 8085,
      },
    },
  ],
}
