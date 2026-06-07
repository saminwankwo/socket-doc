module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.\\.?\\/.+)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
}
