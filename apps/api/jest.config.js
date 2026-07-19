/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  // Integration specs each open a Prisma connection pool against the shared
  // Postgres; run serially so parallel workers don't exhaust connections
  // (see docs/TECHNICAL_DEBT_REGISTER.md TD-016).
  maxWorkers: 1,
};
