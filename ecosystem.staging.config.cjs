module.exports = {
  apps: [
    {
      name: 'syasha-samaj-staging',

      // The server never runs `next build` — LocalSyncDeployer.sh ships the
      // build output (.next) from the developer machine. We run the shipped
      // build with `next start` instead of the standalone server.
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8086 -H 0.0.0.0',
      cwd: __dirname,

      instances: 1,
      exec_mode: 'fork',

      max_memory_restart: '1G',
      node_args: '--max-old-space-size=300',

      env: {
        NODE_ENV: 'production',
        PORT: 8086,
      },
    },
  ],
};
