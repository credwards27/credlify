/* server-task.js
    
    Gulp liver server task code.
*/

module.exports = `
/* Live reload server.
*/
gulp.task("server", (done) => {
    liveServer.start({
        port: 8080,
        host: "localhost",
        root: "%%[dest]%%",
        open: false,
        file: "index.html",
        wait: 250
    });
    
    done();
});
`;
