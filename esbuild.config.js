import esbuildServe from "esbuild-serve";

esbuildServe(
  {
    logLevel: "info",
    entryPoints: ["src/js/index.js"],
    bundle: true,
    outfile: "www/main.js",
    sourcemap: true,
    loader: {
      ".woff": "file",
      ".svg": "file",
      ".png": "file",
  },
  },
  { root: "www" }
);
