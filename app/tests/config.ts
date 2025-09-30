import "dotenv/config";

const url = process.env["APP_URL"] || "";
const username = process.env["TEST_USERNAME"] || "";
const password = process.env["TEST_PASSWORD"] || "";
const frf2024MongoId = process.env["TEST_FRF_2024_MONGO_ID"] || "";

export { url, username, password, frf2024MongoId };
