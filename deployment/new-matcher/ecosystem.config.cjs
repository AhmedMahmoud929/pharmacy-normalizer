/** PM2 config — source deploy.env before: pm2 start deployment/new-matcher/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "new-matcher-frontend",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${process.env.FRONTEND_PORT || 3005}`,
      cwd: process.env.PROJECT_ROOT
        ? `${process.env.PROJECT_ROOT}/frontend`
        : `${__dirname}/../../frontend`,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_TTL_HOURS: process.env.JWT_TTL_HOURS || "12",
      },
    },
  ],
};
