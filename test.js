import { runCommand } from './src/spawn.js';

console.log('GH_TOKEN:', !!process.env.GH_TOKEN);

await runCommand('gh', ['issue', 'view', '8', '--json', 'author,title,body,labels,comments,url'], {
  ignoreExitStatus: true,
});
