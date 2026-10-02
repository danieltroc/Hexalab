#!/bin/sh
# Wraps the artifact-format index.html in a full HTML document for static hosting.
set -e
rm -rf dist && mkdir dist
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'
  cat index.html
  printf '\n</body>\n</html>\n'
} > dist/index.html
cp ui.css lab.css hex.js bench.js extras.js dist/
