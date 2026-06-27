/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@raycast/api$": "<rootDir>/__mocks__/@raycast/api.ts",
    "^@raycast/utils$": "<rootDir>/__mocks__/@raycast/utils.ts"
  }
};
