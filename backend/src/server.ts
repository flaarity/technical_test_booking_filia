import "dotenv/config";
import app from "./app.js";

const configuredPort = process.env["PORT"]?.trim();
const port = configuredPort ? Number(configuredPort) : 4000;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT harus berupa angka antara 1 dan 65535.");
}

app.listen(port, () => {
  console.info(`Book-in API listening on port ${port}`);
});
