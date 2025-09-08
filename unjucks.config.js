export default {
  "latex": {
    "engine": "pdflatex",
    "outputDir": "./dist/latex",
    "tempDir": "./temp/latex",
    "enableBibtex": true,
    "enableBiber": true,
    "watch": {
      "enabled": false,
      "patterns": [
        "**/*.tex",
        "**/*.bib"
      ]
    },
    "docker": {
      "enabled": false,
      "image": "texlive/texlive:latest"
    }
  }
};