/** @file server/boot.js — loaded into shared server scope (do not require() alone). */
serverTickLoop();
setupServerConsole();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use — close the other server or kill the process.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

accountsDb.ready.then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Dedicated server listening on http://${HOST}:${PORT}`);
    console.log(`Matchmaking: ${PLAYERS_PER_MATCH} players per match`);
    console.log(`Accounts DB: ${accountsDb.DB_PATH}`);
  });
}).catch((err) => {
  console.error('Failed to open accounts database:', err && err.message ? err.message : err);
  process.exit(1);
});
