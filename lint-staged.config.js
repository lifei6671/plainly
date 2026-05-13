const MAX_FILES_PER_COMMAND = 40;

function quoteFile(file) {
  return JSON.stringify(file);
}

function chunkFiles(files) {
  const chunks = [];
  for (let index = 0; index < files.length; index += MAX_FILES_PER_COMMAND) {
    chunks.push(files.slice(index, index + MAX_FILES_PER_COMMAND));
  }
  return chunks;
}

function buildChunkedCommands(files, commandBuilder) {
  return chunkFiles(files).map((chunk) => commandBuilder(chunk.map(quoteFile).join(" ")));
}

module.exports = {
  "src/**/*.{jsx,js,json}": (files) => [
    ...buildChunkedCommands(files, (quotedFiles) => `prettier --write ${quotedFiles}`),
    ...buildChunkedCommands(files, (quotedFiles) => `eslint --fix ${quotedFiles}`),
    ...buildChunkedCommands(files, (quotedFiles) => `git add -- ${quotedFiles}`),
  ],
  "src/**/*.{tsx,ts}": (files) => [
    ...buildChunkedCommands(files, (quotedFiles) => `eslint --fix ${quotedFiles}`),
    ...buildChunkedCommands(files, (quotedFiles) => `git add -- ${quotedFiles}`),
  ],
};
