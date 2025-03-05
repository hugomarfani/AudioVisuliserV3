/**
 * Clean folders for release app dist, and dll
 */
const { rimraf } = require('rimraf');
const path = require('path');
const args = require('minimist')(process.argv.slice(2));
 
const foldersToRemove = [
  args._[0] === 'dist' && path.join(__dirname, '../../release/app/dist'),
  path.join(__dirname, '../../.erb/dll'),
].filter(Boolean);
 
// rimraf.sync doesn't exist in newer versions, use the synchronous version
// of fs.rmSync which is built into Node.js
const fs = require('fs');
 
foldersToRemove.forEach((folder) => {
  if (fs.existsSync(folder)) {
    console.log(`Cleaning directory: ${folder}`);
    try {
      fs.rmSync(folder, { recursive: true, force: true });
      console.log(`Successfully deleted: ${folder}`);
    } catch (err) {
      console.error(`Error while deleting ${folder}: ${err.message}`);
    }
  } else {
    console.log(`Directory doesn't exist, skipping: ${folder}`);
  }
});
 