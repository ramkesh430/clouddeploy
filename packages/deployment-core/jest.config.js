/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    "^@clouddeploy/types$": "<rootDir>/../types/src",
  },
};
