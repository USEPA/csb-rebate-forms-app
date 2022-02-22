const path = require("path");
const express = require("express");

const routes = require("./routes.js");

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, "app", "public")));

app.use("/", routes);

app.get("*", (req, res, next) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
