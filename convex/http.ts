import { httpRouter } from "convex/server";
import { importResults } from "./resultsImport";

const http = httpRouter();

http.route({
  path: "/api/import-results",
  method: "POST",
  handler: importResults,
});

export default http;
