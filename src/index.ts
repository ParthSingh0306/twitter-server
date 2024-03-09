import * as dotnev from "dotenv";
import { initServer } from "./app";

dotnev.config();

async function init() {
  const app = await initServer();

  app.listen(8000, () => {
    console.log(`Server started at PORT:8000`);
  });
}

init();
